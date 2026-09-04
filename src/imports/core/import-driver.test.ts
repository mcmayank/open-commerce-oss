import { describe, it, expect } from 'vitest'
import { driveImport, type TickResponse } from './import-driver'

/** A tick function that replays scripted responses in order. */
function scripted(...responses: TickResponse[]) {
  let i = 0
  return async () => responses[Math.min(i++, responses.length - 1)]
}

const noSleep = async () => {}

describe('driveImport', () => {
  it('pumps ticks until the import is complete', async () => {
    const progress: { imported: number; remaining: number }[] = []
    const result = await driveImport({
      total: 3,
      tick: scripted(
        { ok: true, imported: 2, failed: 0, remaining: 1, processed: 2, status: 'importing' },
        { ok: true, imported: 1, failed: 0, remaining: 0, processed: 1, status: 'completed' },
      ),
      onProgress: (p) => progress.push({ imported: p.imported, remaining: p.remaining }),
      sleep: noSleep,
    })

    expect(result).toEqual({ status: 'completed', imported: 3, failed: 0 })
    // Progress is cumulative across ticks, not per-batch.
    expect(progress).toEqual([
      { imported: 2, remaining: 1 },
      { imported: 3, remaining: 0 },
    ])
  })

  it('accumulates failures alongside successes', async () => {
    const result = await driveImport({
      total: 4,
      tick: scripted(
        { ok: true, imported: 2, failed: 1, remaining: 1, processed: 3, status: 'importing' },
        { ok: true, imported: 0, failed: 1, remaining: 0, processed: 1, status: 'completed' },
      ),
      onProgress: () => {},
      sleep: noSleep,
    })

    expect(result).toEqual({ status: 'completed', imported: 2, failed: 2 })
  })

  it('seeds from counts already imported, so a reopened import resumes correctly', async () => {
    const first: { imported: number }[] = []
    const result = await driveImport({
      total: 10,
      initialImported: 6,
      initialFailed: 1,
      tick: scripted({ ok: true, imported: 3, failed: 0, remaining: 0, processed: 3, status: 'completed' }),
      onProgress: (p) => first.push({ imported: p.imported }),
      sleep: noSleep,
    })

    expect(result).toEqual({ status: 'completed', imported: 9, failed: 1 })
    expect(first[0].imported).toBe(9)
  })

  // The server's message is written for the merchant (plan cap, tax missing),
  // so it is surfaced verbatim rather than replaced with something generic.
  it('stops and surfaces the server error when a tick fails', async () => {
    const result = await driveImport({
      total: 5,
      tick: scripted(
        { ok: true, imported: 2, failed: 0, remaining: 3, processed: 2, status: 'importing' },
        { ok: false, error: 'This store has reached its plan limit of 50 products.' },
      ),
      onProgress: () => {},
      sleep: noSleep,
    })

    expect(result).toEqual({
      status: 'failed',
      error: 'This store has reached its plan limit of 50 products.',
      imported: 2,
      failed: 0,
    })
  })

  it('stops when asked to, without another tick', async () => {
    let ticks = 0
    const result = await driveImport({
      total: 5,
      tick: async () => {
        ticks++
        return { ok: true, imported: 1, failed: 0, remaining: 4, processed: 1, status: 'importing' }
      },
      onProgress: () => {},
      shouldStop: () => ticks >= 2,
      sleep: noSleep,
    })

    expect(result.status).toBe('stopped')
    expect(ticks).toBe(2)
  })

  // The bug behind "stuck at 10": a tick whose request throws (a serverless
  // timeout drops the connection) must NOT kill the loop silently. It is
  // transient, so it retries and carries on.
  it('retries a tick that throws, and continues once it recovers', async () => {
    let call = 0
    const result = await driveImport({
      total: 4,
      tick: async () => {
        call++
        if (call === 2) throw new TypeError('Failed to fetch')
        if (call === 1) return { ok: true, imported: 2, failed: 0, remaining: 2, processed: 2, status: 'importing' }
        return { ok: true, imported: 2, failed: 0, remaining: 0, processed: 2, status: 'completed' }
      },
      onProgress: () => {},
      sleep: noSleep,
    })

    expect(result).toEqual({ status: 'completed', imported: 4, failed: 0 })
  })

  // If the connection stays down, it gives up with an honest error rather than
  // freezing the screen forever.
  it('gives up after repeated throws instead of hanging', async () => {
    const result = await driveImport({
      total: 5,
      tick: async () => {
        throw new TypeError('Failed to fetch')
      },
      onProgress: () => {},
      sleep: noSleep,
      maxRetries: 3,
    })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.error).toMatch(/connection|reach|server/i)
  })

  // A clean server error (plan cap) is NOT retried — it is a final answer.
  it('does not retry a clean server error', async () => {
    let calls = 0
    const result = await driveImport({
      total: 5,
      tick: async () => {
        calls++
        return { ok: false, error: 'Plan limit reached.' }
      },
      onProgress: () => {},
      sleep: noSleep,
      maxRetries: 3,
    })

    expect(result.status).toBe('failed')
    expect(calls).toBe(1)
  })

  // A tick that claims nothing while work remains means two drivers are racing
  // or the job is wedged. Spinning forever is worse than stopping.
  it('stops if a tick makes no progress, rather than looping forever', async () => {
    const result = await driveImport({
      total: 5,
      tick: scripted({ ok: true, imported: 0, failed: 0, remaining: 5, processed: 0, status: 'importing' }),
      onProgress: () => {},
      sleep: noSleep,
    })

    expect(result.status).toBe('stalled')
  })
})
