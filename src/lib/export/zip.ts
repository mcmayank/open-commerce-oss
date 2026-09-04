/**
 * Minimal store-only (method 0, uncompressed) zip writer.
 *
 * Written rather than depended on: the archive holds a handful of small text
 * files, so compression buys little, and the alternative is a dependency in
 * the request path of a route that handles customer PII. Store-only keeps the
 * format to three record types with no deflate state to get wrong.
 *
 * Deliberately fixed DOS timestamp (1980-01-01) so the same input always
 * produces the same bytes — a changing mtime would make the output
 * untestable byte-for-byte for no merchant benefit.
 *
 * ZIP32 only, no ZIP64: entries and the archive are limited to the standard
 * 32-bit fields (max ~4GB per entry, max 65535 entries). `Buffer.writeUInt32LE`
 * throws rather than silently truncating on overflow, so exceeding either
 * ceiling fails loudly instead of producing a corrupt archive.
 */

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/** Bit 11 marks the filename as UTF-8, which matters for non-ASCII entries. */
const FLAG_UTF8 = 0x0800
const DOS_TIME = 0
const DOS_DATE = 0x0021 // 1980-01-01

export function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data)
    const crc = crc32(entry.data)

    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(FLAG_UTF8, 6)
    local.writeUInt16LE(0, 8) // method 0 = stored
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18) // compressed size
    local.writeUInt32LE(data.length, 22) // uncompressed size
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28) // extra field length
    name.copy(local, 30)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0) // central directory signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(FLAG_UTF8, 8)
    central.writeUInt16LE(0, 10) // method
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30) // extra length
    central.writeUInt16LE(0, 32) // comment length
    central.writeUInt16LE(0, 34) // disk number start
    central.writeUInt16LE(0, 36) // internal attributes
    central.writeUInt32LE(0, 38) // external attributes
    central.writeUInt32LE(offset, 42) // offset of local header
    name.copy(central, 46)

    locals.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }

  const centralBlock = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  end.writeUInt16LE(0, 4) // this disk
  end.writeUInt16LE(0, 6) // disk with central directory
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBlock.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...locals, centralBlock, end])
}
