import { describe, expect, it, vi } from 'vitest'
import { formatInvoiceNumber, allocateInvoiceNumber } from './number'
// These cases assert the multi-store query shapes, so pin the store-scope seam
// to its hosted branch; the OSS export replaces the overlay with the single-store one.
vi.mock('@/store-scope-overlay', () => ({ hostedScope: true }))

describe('formatInvoiceNumber', () => {
  it('zero-pads to 5 digits with an INV- prefix', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-00001')
    expect(formatInvoiceNumber(42)).toBe('INV-00042')
    expect(formatInvoiceNumber(123456)).toBe('INV-123456')
  })
})

describe('allocateInvoiceNumber', () => {
  it('returns the current counter and increments it, scoped to the tenant', async () => {
    const update = vi.fn().mockResolvedValue({})
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 'ss1', nextInvoiceNumber: 7 }] })
    const payload = { find, update } as never

    const num = await allocateInvoiceNumber(payload, 'tenant-a')

    expect(num).toBe('INV-00007')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'store-settings', where: { tenant: { equals: 'tenant-a' } } }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'store-settings', id: 'ss1', data: { nextInvoiceNumber: 8 } }),
    )
  })

  it('defaults to 1 when the counter is unset', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'ss1' }] }),
      update: vi.fn().mockResolvedValue({}),
    }
    expect(await allocateInvoiceNumber(payload as never, 't')).toBe('INV-00001')
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nextInvoiceNumber: 2 } }),
    )
  })

  it('rejects when no store-settings doc exists', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update: vi.fn().mockResolvedValue({}),
    } as never
    await expect(allocateInvoiceNumber(payload, 't')).rejects.toThrow('Cannot allocate invoice number: no store-settings for tenant t')
  })
})
