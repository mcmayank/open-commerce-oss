// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { ExportDataCard } from './ExportDataCard'

// jsdom does not implement the Blob-URL pair the component relies on, so every
// test that exercises the actual download path stubs both methods directly
// (they don't exist on jsdom's URL to begin with, so `vi.spyOn` — which
// requires the property to already exist — cannot be used here).
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

/** Renders the card, clicks export, and waits for the anchor's `click()` to fire. */
async function triggerDownload() {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  let anchor: HTMLAnchorElement | null = null

  // render() itself appends RTL's container div to document.body, so the spy
  // must only intercept the component's own anchor element (identified by
  // tagName) and fall through to the real appendChild for everything else —
  // otherwise RTL's container never lands in the DOM and nothing renders.
  const appendSpy = vi
    .spyOn(document.body, 'appendChild')
    .mockImplementation(function (this: Node, node: Node) {
      if (node instanceof HTMLAnchorElement) anchor = node
      return Node.prototype.appendChild.call(this, node)
    })

  render(<ExportDataCard />)
  fireEvent.click(screen.getByRole('button', { name: /export/i }))
  await waitFor(() => expect(clickSpy).toHaveBeenCalled())

  appendSpy.mockRestore()
  return anchor as unknown as HTMLAnchorElement
}

describe('ExportDataCard', () => {
  it('offers the download and says what is included', () => {
    render(<ExportDataCard />)
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
    // The claim the card is here to make true — it must name the three nouns.
    expect(screen.getByText(/catalog, orders and customers/i)).toBeTruthy()
  })

  it('surfaces a failure instead of failing silently', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not authorised.' }), { status: 403 }),
    )
    render(<ExportDataCard />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/could not/i)
    })
  })

  // The download path — blob in, anchor out — is the component's only reason
  // to exist, and nothing exercised it before this test. Covers
  // createObjectURL → anchor.download named from Content-Disposition → click.
  it('names the downloaded file from the Content-Disposition header', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['PK'], { type: 'application/zip' }), {
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="niblr-export-sdbakery-2026-08-04.zip"',
        },
      }),
    )

    const anchor = await triggerDownload()

    expect(anchor.download).toBe('niblr-export-sdbakery-2026-08-04.zip')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  // No Content-Disposition (e.g. a proxy stripped it) must still produce a
  // usable download rather than an untitled file.
  it('falls back to a generic filename when Content-Disposition is absent', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['PK'], { type: 'application/zip' }), { status: 200 }),
    )

    const anchor = await triggerDownload()

    expect(anchor.download).toBe('niblr-export.zip')
  })
})
