import { describe, expect, it } from 'vitest'
import {
  addDays,
  earliestFulfilmentDate,
  formatDayLabel,
  formatFulfilmentSummary,
  listFulfilmentDates,
  validateFulfilmentSelection,
  type FulfillmentConfig,
} from './fulfillment'

// Dubai is UTC+4 year-round (no DST).
const TZ = 'Asia/Dubai'

/** Build a Date from a Dubai wall-clock time. */
function dubai(dayISO: string, time: string): Date {
  return new Date(`${dayISO}T${time}:00+04:00`)
}

const CONFIG: FulfillmentConfig = {
  enabled: true,
  timezone: TZ,
  cutoffTime: '21:00',
  maxDaysAhead: 7,
  pickup: {
    enabled: true,
    locationLabel: 'SD Bakery, Jumeirah — Dubai',
    windows: [
      { label: '07:00–09:00', start: '07:00', end: '09:00' },
      { label: '09:00–12:00', start: '09:00', end: '12:00' },
    ],
  },
  delivery: {
    enabled: true,
    zones: [
      { name: 'Jumeirah & Umm Suqeim', fee: 1000 },
      { name: 'Downtown & Business Bay', fee: 1500 },
    ],
    windows: [{ label: 'Morning (08:00–12:00)', start: '08:00', end: '12:00' }],
  },
}

describe('addDays / formatDayLabel', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-12-31', 2)).toBe('2027-01-02')
  })

  it('formats a stable human label', () => {
    expect(formatDayLabel('2026-07-11')).toBe('Saturday 11 July')
  })
})

describe('earliestFulfilmentDate', () => {
  it('before the 21:00 Dubai cutoff → tomorrow', () => {
    expect(earliestFulfilmentDate(dubai('2026-07-10', '20:59'), '21:00', TZ)).toBe('2026-07-11')
  })

  it('at/after the cutoff → day after tomorrow', () => {
    expect(earliestFulfilmentDate(dubai('2026-07-10', '21:00'), '21:00', TZ)).toBe('2026-07-12')
    expect(earliestFulfilmentDate(dubai('2026-07-10', '23:30'), '21:00', TZ)).toBe('2026-07-12')
  })

  it('evaluates the cutoff in store-local time, not UTC', () => {
    // 22:00 Dubai on the 10th is 18:00 UTC on the 10th — still "after cutoff"
    // locally even though UTC is well before 21:00.
    const lateDubaiEarlyUTC = new Date('2026-07-10T18:00:00Z') // 22:00 in Dubai
    expect(earliestFulfilmentDate(lateDubaiEarlyUTC, '21:00', TZ)).toBe('2026-07-12')

    // 01:00 Dubai on the 11th is 21:00 UTC on the 10th — a NEW local day has
    // begun, so "tomorrow" is the 12th.
    const earlyDubaiLateUTC = new Date('2026-07-10T21:00:00Z') // 01:00 on the 11th in Dubai
    expect(earliestFulfilmentDate(earlyDubaiLateUTC, '21:00', TZ)).toBe('2026-07-12')
  })

  it('falls back to 21:00 for malformed cutoff strings', () => {
    expect(earliestFulfilmentDate(dubai('2026-07-10', '20:00'), 'bogus', TZ)).toBe('2026-07-11')
  })
})

describe('listFulfilmentDates', () => {
  it('offers maxDaysAhead consecutive days starting at the earliest date', () => {
    const dates = listFulfilmentDates(dubai('2026-07-10', '10:00'), CONFIG)
    expect(dates).toHaveLength(7)
    expect(dates[0].iso).toBe('2026-07-11')
    expect(dates[6].iso).toBe('2026-07-17')
    expect(dates[0].label).toMatch(/Saturday/)
  })

  it('clamps maxDaysAhead to at least 1', () => {
    const dates = listFulfilmentDates(dubai('2026-07-10', '10:00'), { ...CONFIG, maxDaysAhead: 0 })
    expect(dates).toHaveLength(1)
  })
})

describe('validateFulfilmentSelection', () => {
  const now = dubai('2026-07-10', '10:00')

  it('accepts a valid pickup selection with zero fee', () => {
    const r = validateFulfilmentSelection(
      { method: 'pickup', dateISO: '2026-07-11', windowLabel: '07:00–09:00' },
      CONFIG,
      now,
    )
    expect(r).toEqual({
      ok: true,
      snapshot: { method: 'pickup', dateISO: '2026-07-11', windowLabel: '07:00–09:00', fee: 0 },
    })
  })

  it('accepts a valid delivery selection and resolves the zone fee', () => {
    const r = validateFulfilmentSelection(
      {
        method: 'delivery',
        dateISO: '2026-07-12',
        windowLabel: 'Morning (08:00–12:00)',
        zoneName: 'Downtown & Business Bay',
      },
      CONFIG,
      now,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.snapshot.fee).toBe(1500)
      expect(r.snapshot.zoneName).toBe('Downtown & Business Bay')
    }
  })

  it('rejects an unknown method', () => {
    const r = validateFulfilmentSelection({ method: 'teleport' }, CONFIG, now)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.fulfillmentMethod).toBeTruthy()
  })

  it('rejects delivery when delivery is disabled', () => {
    const config = { ...CONFIG, delivery: { ...CONFIG.delivery, enabled: false } }
    const r = validateFulfilmentSelection(
      { method: 'delivery', dateISO: '2026-07-11', windowLabel: 'Morning (08:00–12:00)' },
      config,
      now,
    )
    expect(r.ok).toBe(false)
  })

  it('rejects a date before the cutoff-derived minimum', () => {
    // After the cutoff, tomorrow (the 11th) is no longer offered.
    const lateNow = dubai('2026-07-10', '22:00')
    const r = validateFulfilmentSelection(
      { method: 'pickup', dateISO: '2026-07-11', windowLabel: '07:00–09:00' },
      CONFIG,
      lateNow,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors.fulfillmentDate).toBeTruthy()
  })

  it('rejects a date past maxDaysAhead', () => {
    const r = validateFulfilmentSelection(
      { method: 'pickup', dateISO: '2026-08-15', windowLabel: '07:00–09:00' },
      CONFIG,
      now,
    )
    expect(r.ok).toBe(false)
  })

  it('rejects unknown windows and zones', () => {
    const badWindow = validateFulfilmentSelection(
      { method: 'pickup', dateISO: '2026-07-11', windowLabel: '03:00–04:00' },
      CONFIG,
      now,
    )
    expect(badWindow.ok).toBe(false)

    const badZone = validateFulfilmentSelection(
      {
        method: 'delivery',
        dateISO: '2026-07-11',
        windowLabel: 'Morning (08:00–12:00)',
        zoneName: 'Atlantis',
      },
      CONFIG,
      now,
    )
    expect(badZone.ok).toBe(false)
    if (!badZone.ok) expect(badZone.fieldErrors.deliveryZone).toBeTruthy()
  })

  it('rejects fractional zone fees (minor-units invariant)', () => {
    const config: FulfillmentConfig = {
      ...CONFIG,
      delivery: { enabled: true, zones: [{ name: 'Broken', fee: 10.5 }], windows: CONFIG.delivery!.windows },
    }
    const r = validateFulfilmentSelection(
      { method: 'delivery', dateISO: '2026-07-11', windowLabel: 'Morning (08:00–12:00)', zoneName: 'Broken' },
      config,
      now,
    )
    expect(r.ok).toBe(false)
  })
})

describe('formatFulfilmentSummary', () => {
  it('renders pickup and delivery summaries', () => {
    expect(
      formatFulfilmentSummary({ method: 'pickup', date: '2026-07-11T12:00:00.000Z', windowLabel: '07:00–09:00' }),
    ).toBe('Pickup · Saturday 11 July · 07:00–09:00')
    expect(
      formatFulfilmentSummary({
        method: 'delivery',
        date: '2026-07-12T12:00:00.000Z',
        windowLabel: 'Morning (08:00–12:00)',
        zoneName: 'Jumeirah & Umm Suqeim',
      }),
    ).toBe('Delivery · Sunday 12 July · Morning (08:00–12:00) · (Jumeirah & Umm Suqeim)')
  })

  it('returns null for shipping/absent method', () => {
    expect(formatFulfilmentSummary({ method: 'shipping' })).toBeNull()
    expect(formatFulfilmentSummary({})).toBeNull()
  })
})
