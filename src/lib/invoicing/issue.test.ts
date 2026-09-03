import { describe, expect, it, vi } from 'vitest'
import { issueInvoice } from './issue'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

function makeDeps() {
  return {
    allocate: vi.fn().mockResolvedValue('INV-00009'),
    buildData: vi.fn().mockReturnValue({ storeName: 'Acme' }),
    renderPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-')),
    send: vi.fn().mockResolvedValue(undefined),
  }
}
function makePayload() {
  return {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 'ss1', storeName: 'Acme' }] }),
    create: vi.fn().mockResolvedValue({ id: 'media1' }),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data })),
  }
}
const baseOrder = { id: 'o1', tenant: 't1', orderNumber: 'ORD-1', email: 'a@b.co', currency: 'USD', total: 100 }

describe('issueInvoice', () => {
  it('is a no-op when already invoiced and not forced', async () => {
    const deps = makeDeps(); const payload = makePayload()
    const order = { ...baseOrder, invoiceNumber: 'INV-00001' } as never
    const result = await issueInvoice(payload as never, order, {}, deps)
    expect(deps.allocate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(result).toBe(order)
  })

  it('allocates, renders, uploads, emails and stamps on first issue', async () => {
    const deps = makeDeps(); const payload = makePayload()
    await issueInvoice(payload as never, baseOrder as never, {}, deps)
    expect(deps.allocate).toHaveBeenCalledWith(payload, 't1')
    expect(deps.renderPdf).toHaveBeenCalled()
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'invoices' }))
    // `alt` existed only because Media requires it on every doc — an
    // accessibility field on a PDF nobody renders.
    const createArg = vi.mocked(payload.create).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createArg.data).not.toHaveProperty('alt')
    expect(createArg.data).toMatchObject({ invoiceNumber: expect.any(String) })
    expect(deps.send).toHaveBeenCalled()
    // Two updates: persist record before send, stamp sentAt after send
    expect(payload.update).toHaveBeenCalledTimes(2)
    // First update: persists invoice record (before send)
    expect(payload.update.mock.calls[0][0]).toEqual(expect.objectContaining({
      collection: 'orders', id: 'o1',
      data: expect.objectContaining({
        invoiceNumber: 'INV-00009',
        invoicePdf: 'media1',
        invoiceIssuedAt: expect.any(String),
      }),
    }))
    // Second update: stamps invoiceSentAt after successful send
    expect(payload.update.mock.calls[1][0]).toEqual(expect.objectContaining({
      collection: 'orders', id: 'o1',
      data: expect.objectContaining({ invoiceSentAt: expect.any(String) }),
    }))
  })

  it('with force on an already-invoiced order reuses the number and re-sends (no allocate)', async () => {
    const deps = makeDeps(); const payload = makePayload()
    const order = { ...baseOrder, invoiceNumber: 'INV-00003', invoiceIssuedAt: '2026-01-01' } as never
    await issueInvoice(payload as never, order, { force: true }, deps)
    expect(deps.allocate).not.toHaveBeenCalled()
    expect(deps.send).toHaveBeenCalled()
    // Two updates: persist record before send, stamp sentAt after send
    expect(payload.update).toHaveBeenCalledTimes(2)
    // First update: reuses invoiceNumber and preserves original invoiceIssuedAt
    expect(payload.update.mock.calls[0][0]).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        invoiceNumber: 'INV-00003',
        invoiceIssuedAt: '2026-01-01',
      }),
    }))
    // Second update: stamps invoiceSentAt
    expect(payload.update.mock.calls[1][0]).toEqual(expect.objectContaining({
      data: expect.objectContaining({ invoiceSentAt: expect.any(String) }),
    }))
  })
})
