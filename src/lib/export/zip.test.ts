// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildZip } from './zip'

const dirs: string[] = []
function writeArchive(buf: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'niblr-zip-'))
  dirs.push(dir)
  const file = join(dir, 'out.zip')
  writeFileSync(file, buf)
  return file
}

afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

const enc = (s: string) => new TextEncoder().encode(s)

describe('buildZip', () => {
  // Hand-written zip containers fail on the merchant's machine, not ours.
  // Assert a real unzip accepts it rather than that bytes were produced.
  it('produces an archive the system unzip verifies', () => {
    const zip = buildZip([
      { name: 'a.csv', data: enc('one,two\r\n1,2\r\n') },
      { name: 'README.txt', data: enc('hello') },
    ])
    const out = execFileSync('unzip', ['-t', writeArchive(zip)], { encoding: 'utf8' })
    expect(out).toContain('No errors detected')
  })

  it('reads back every entry byte-identical', () => {
    const body = 'خبز طازج,1250\r\n'
    const file = writeArchive(buildZip([{ name: 'products.csv', data: enc(body) }]))
    const read = execFileSync('unzip', ['-p', file, 'products.csv'])
    expect(new TextDecoder().decode(read)).toBe(body)
  })

  it('lists entries under their given names', () => {
    const file = writeArchive(
      buildZip([
        { name: 'orders.csv', data: enc('x') },
        { name: 'order-items.csv', data: enc('y') },
      ]),
    )
    const listing = execFileSync('unzip', ['-l', file], { encoding: 'utf8' })
    expect(listing).toContain('orders.csv')
    expect(listing).toContain('order-items.csv')
  })

  it('handles an empty entry', () => {
    const file = writeArchive(buildZip([{ name: 'empty.csv', data: enc('') }]))
    const out = execFileSync('unzip', ['-t', file], { encoding: 'utf8' })
    expect(out).toContain('No errors detected')
  })

  // Integrity check for a multi-byte name alongside a neighbour, plus proof
  // that unzip's own CLI name-matching is unreliable for non-ASCII names on
  // this machine (see note below) — NOT a regression test for a byte-length
  // vs UTF-16-length bug. A byte-length substitution at every site in
  // zip.ts is self-consistent (allocation, header field, and offset
  // accumulator all shrink together), so it corrupts only the stored name
  // and misaligns nothing after it; this test would stay green through that
  // exact bug. See "stores a non-ASCII entry name at its full UTF-8 byte
  // length" below for the test that actually catches it.
  //
  // Note on this specific assertion shape: this machine's system `unzip`
  // (`UnZip 6.00 of 20 April 2009, by Info-ZIP, with modifications by Apple
  // Inc.`) does not honor the UTF-8 general-purpose bit (11) when matching a
  // non-ASCII name passed as a CLI argument — `unzip -p file 'منتجات.csv'`
  // reports "filename not matched" even though the archive is byte-correct.
  // Verified independently with Python's zipfile: `namelist()` returns the
  // exact name, `flag_bits` shows the UTF-8 flag set, `read()` returns the
  // exact bytes, and `unzip -t` / `unzip -p` (with no name filter, reading
  // every entry positionally) both succeed. So this test reads the
  // non-ASCII entry back positionally instead of by matching its name, and
  // reads the following entry by name to prove the offset arithmetic after
  // it is correct — still a real `unzip` round-trip, not a bytes comparison.
  it('handles a non-ASCII entry name without corrupting what follows it', () => {
    const file = writeArchive(
      buildZip([
        { name: 'منتجات.csv', data: enc('a,b\r\n') },
        { name: 'after.csv', data: enc('c,d\r\n') },
      ]),
    )
    expect(execFileSync('unzip', ['-t', file], { encoding: 'utf8' })).toContain('No errors detected')
    expect(new TextDecoder().decode(execFileSync('unzip', ['-p', file, 'after.csv']))).toBe('c,d\r\n')
  })

  // A byte-length regression is self-consistent — allocation, header field
  // and offset accumulator all shrink together — so it corrupts ONLY the
  // stored name and misaligns nothing. Neighbouring entries and `unzip -t`
  // therefore cannot detect it; the name field must be read directly.
  it('stores a non-ASCII entry name at its full UTF-8 byte length', () => {
    const name = 'منتجات.csv'
    const zip = buildZip([{ name, data: enc('a,b\r\n') }])

    // Local file header: name length is a UInt16LE at offset 26, name at 30.
    const nameLength = zip.readUInt16LE(26)
    expect(nameLength).toBe(Buffer.byteLength(name, 'utf8'))
    expect(nameLength).not.toBe(name.length) // UTF-16 units — the bug
    expect(zip.subarray(30, 30 + nameLength).toString('utf8')).toBe(name)
  })

  // On this machine's system `unzip`, a genuinely empty (0-entry) archive
  // is treated as informational rather than listable: `unzip -l` exits
  // non-zero and warns "zipfile is empty" to stderr instead of printing a
  // "0 files" listing. Confirmed this is a correct empty archive (not a
  // container bug) independently with Python's zipfile: `namelist() == []`
  // and `testzip() is None`. Assertion adjusted to match what this
  // platform's unzip actually prints for a correct empty archive.
  it('produces a valid archive for no entries at all', () => {
    const file = writeArchive(buildZip([]))
    let output = ''
    try {
      output = execFileSync('unzip', ['-l', file], { encoding: 'utf8' })
    } catch (err) {
      const { stdout, stderr } = err as { stdout?: string; stderr?: string }
      output = `${stdout ?? ''}${stderr ?? ''}`
    }
    expect(output).toContain('zipfile is empty')
  })
})
