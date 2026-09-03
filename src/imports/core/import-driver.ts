/**
 * Drives an import to completion by pumping the `/tick` endpoint.
 *
 * The tick is resumable and processes a slice per call, which is what lets an
 * import survive a serverless timeout or a closed tab. Something has to keep
 * calling it, and reporting progress while it does — that is this loop. It was
 * missing entirely: the review screen committed a job to `importing` and never
 * pumped it, so no import ever ran through the UI.
 *
 * Pure of the network and the DOM: `tick` and `sleep` are injected, so the
 * whole progress-and-termination behaviour is unit-testable.
 */

export type TickResponse =
  | {
      ok: true
      /** Imported in THIS tick, not cumulative. */
      imported: number
      /** Failed in this tick. */
      failed: number
      /** Items still selected and waiting — authoritative, from the server. */
      remaining: number
      /** Items this tick claimed. Zero while work remains means a stall. */
      processed: number
      status: 'importing' | 'completed'
    }
  | { ok: false; error: string }

export type ImportProgress = {
  imported: number
  failed: number
  remaining: number
  total: number
}

export type DriveResult =
  | { status: 'completed'; imported: number; failed: number }
  | { status: 'failed'; error: string; imported: number; failed: number }
  | { status: 'stopped'; imported: number; failed: number }
  | { status: 'stalled'; imported: number; failed: number }

export type DriveOptions = {
  tick: () => Promise<TickResponse>
  /** Selected count, for the denominator of the progress bar. */
  total: number
  onProgress: (progress: ImportProgress) => void
  /** Counts already imported before this drive — non-zero on a resumed import. */
  initialImported?: number
  initialFailed?: number
  /** Return true to end the loop after the current tick (e.g. tab closing). */
  shouldStop?: () => boolean
  /** Spacing between ticks. Injected so tests do not wait. */
  sleep?: (ms: number) => Promise<void>
  /** Delay between ticks in ms. */
  intervalMs?: number
  /**
   * Consecutive thrown ticks tolerated before giving up. A thrown tick is a
   * dropped connection — a serverless timeout on an image-heavy batch — which
   * is transient, so it is retried rather than treated as a final answer. A
   * clean `{ ok: false }` from the server IS final and is never retried.
   */
  maxRetries?: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function driveImport(opts: DriveOptions): Promise<DriveResult> {
  const sleep = opts.sleep ?? defaultSleep
  const interval = opts.intervalMs ?? 800

  const maxRetries = opts.maxRetries ?? 4

  let imported = opts.initialImported ?? 0
  let failed = opts.initialFailed ?? 0
  let consecutiveThrows = 0

  for (;;) {
    if (opts.shouldStop?.()) return { status: 'stopped', imported, failed }

    let result: TickResponse
    try {
      result = await opts.tick()
    } catch {
      // A thrown tick is a lost connection, not a verdict. Retry with backoff;
      // give up only after several in a row, and say so rather than freeze.
      consecutiveThrows += 1
      if (consecutiveThrows > maxRetries) {
        return {
          status: 'failed',
          error:
            'Lost the connection to the server while importing. ' +
            `${imported} product${imported === 1 ? '' : 's'} imported so far were kept — ` +
            'reopen this page to carry on from where it stopped.',
          imported,
          failed,
        }
      }
      await sleep(interval * consecutiveThrows)
      continue
    }
    consecutiveThrows = 0

    if (!result.ok) {
      return { status: 'failed', error: result.error, imported, failed }
    }

    imported += result.imported
    failed += result.failed
    opts.onProgress({ imported, failed, remaining: result.remaining, total: opts.total })

    if (result.status === 'completed' || result.remaining === 0) {
      return { status: 'completed', imported, failed }
    }

    // A tick that claimed nothing while items remain is not going to make
    // progress on the next pass either — another driver holds the rows, or the
    // job is wedged. Stopping beats spinning.
    if (result.processed === 0) {
      return { status: 'stalled', imported, failed }
    }

    await sleep(interval)
  }
}
