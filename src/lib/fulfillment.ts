/**
 * Pickup / local-delivery scheduling — pure, timezone-aware helpers.
 *
 * All functions take `now` explicitly so cutoff behaviour is unit-testable.
 * Dates are exchanged as ISO calendar days (YYYY-MM-DD) interpreted in the
 * store's timezone; the server is authoritative — the client picker only
 * improves UX.
 */

export type FulfillmentWindow = { label: string; start: string; end: string; id?: string | null }
export type DeliveryZone = { name: string; areasNote?: string | null; fee: number; id?: string | null }

export type FulfillmentConfig = {
  enabled?: boolean | null
  timezone?: string | null
  cutoffTime?: string | null
  maxDaysAhead?: number | null
  pickup?: {
    enabled?: boolean | null
    locationLabel?: string | null
    windows?: FulfillmentWindow[] | null
  } | null
  delivery?: {
    enabled?: boolean | null
    zones?: DeliveryZone[] | null
    windows?: FulfillmentWindow[] | null
  } | null
}

export type FulfillmentMethod = 'pickup' | 'delivery'

export type FulfillmentSnapshot = {
  method: FulfillmentMethod
  /** ISO calendar day (YYYY-MM-DD) in the store's timezone. */
  dateISO: string
  windowLabel: string
  zoneName?: string
  /** Delivery fee in minor units; 0 for pickup. */
  fee: number
}

export type FulfillmentValidation =
  | { ok: true; snapshot: FulfillmentSnapshot }
  | { ok: false; fieldErrors: Record<string, string> }

/** Calendar day (YYYY-MM-DD) and wall-clock time (HH:mm) of `now` in `timezone`. */
function nowInZone(now: Date, timezone: string): { day: string; time: string } {
  // en-CA yields YYYY-MM-DD ordering
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return { day, time }
}

/** Add whole calendar days to a YYYY-MM-DD string (pure date math, UTC-based). */
export function addDays(dayISO: string, days: number): string {
  const [y, m, d] = dayISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Human label for a YYYY-MM-DD day, e.g. "Saturday 11 July". */
export function formatDayLabel(dayISO: string): string {
  const [y, m, d] = dayISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
}

function isValidHHmm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/**
 * Earliest schedulable day. Before the cutoff (store-local) orders go out the
 * next day; at/after the cutoff, the day after next.
 */
export function earliestFulfilmentDate(
  now: Date,
  cutoffTime: string,
  timezone: string,
): string {
  const cutoff = isValidHHmm(cutoffTime) ? cutoffTime : '21:00'
  const { day, time } = nowInZone(now, timezone)
  // Zero-padded HH:mm strings compare correctly lexicographically.
  return addDays(day, time < cutoff ? 1 : 2)
}

export type FulfilmentDateOption = { iso: string; label: string }

/** Selectable days: earliest date through `maxDaysAhead` days ahead. */
export function listFulfilmentDates(now: Date, config: FulfillmentConfig): FulfilmentDateOption[] {
  const timezone = config.timezone || 'Asia/Dubai'
  const earliest = earliestFulfilmentDate(now, config.cutoffTime || '21:00', timezone)
  const count = Math.max(1, Math.floor(config.maxDaysAhead ?? 7))
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(earliest, i)
    return { iso, label: formatDayLabel(iso) }
  })
}

export type FulfillmentFormValues = {
  method?: string | null
  dateISO?: string | null
  windowLabel?: string | null
  zoneName?: string | null
}

/**
 * Validate a buyer's fulfilment selection against store config. Authoritative:
 * unknown windows/zones, disabled methods, and out-of-range dates are all
 * rejected regardless of what the client rendered.
 */
export function validateFulfilmentSelection(
  values: FulfillmentFormValues,
  config: FulfillmentConfig,
  now: Date,
): FulfillmentValidation {
  const fieldErrors: Record<string, string> = {}

  const method = values.method
  const pickupEnabled = config.pickup?.enabled !== false
  const deliveryEnabled = config.delivery?.enabled === true

  if (method !== 'pickup' && method !== 'delivery') {
    return { ok: false, fieldErrors: { fulfillmentMethod: 'Choose pickup or delivery.' } }
  }
  if (method === 'pickup' && !pickupEnabled) {
    return { ok: false, fieldErrors: { fulfillmentMethod: 'Pickup is not available.' } }
  }
  if (method === 'delivery' && !deliveryEnabled) {
    return { ok: false, fieldErrors: { fulfillmentMethod: 'Delivery is not available.' } }
  }

  // Date: must be one of the currently-offered days.
  const offered = listFulfilmentDates(now, config)
  const dateISO = values.dateISO ?? ''
  if (!offered.some((d) => d.iso === dateISO)) {
    fieldErrors.fulfillmentDate = 'Choose an available date.'
  }

  // Window: must exist for the chosen method.
  const windows = (method === 'pickup' ? config.pickup?.windows : config.delivery?.windows) ?? []
  const windowLabel = (values.windowLabel ?? '').trim()
  const window = windows.find((w) => w.label === windowLabel)
  if (!window) {
    fieldErrors.fulfillmentWindow = 'Choose a time window.'
  }

  // Zone: delivery only.
  let zone: DeliveryZone | undefined
  if (method === 'delivery') {
    const zoneName = (values.zoneName ?? '').trim()
    zone = (config.delivery?.zones ?? []).find((z) => z.name === zoneName)
    if (!zone) {
      fieldErrors.deliveryZone = 'Choose a delivery area.'
    } else if (!Number.isInteger(zone.fee) || zone.fee < 0) {
      fieldErrors.deliveryZone = 'This delivery area is misconfigured — please contact the store.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const snapshot: FulfillmentSnapshot = {
    method,
    dateISO,
    windowLabel: window!.label,
    fee: method === 'delivery' ? zone!.fee : 0,
  }
  if (zone) snapshot.zoneName = zone.name

  return { ok: true, snapshot }
}

/** "Saturday 11 July, 07:00–09:00" — shared display helper for emails/pages. */
export function formatFulfilmentSummary(snapshot: {
  method?: string | null
  date?: string | null
  windowLabel?: string | null
  zoneName?: string | null
}): string | null {
  if (!snapshot.method || snapshot.method === 'shipping') return null
  const day = snapshot.date ? formatDayLabel(snapshot.date.slice(0, 10)) : null
  const parts = [
    snapshot.method === 'pickup' ? 'Pickup' : 'Delivery',
    day,
    snapshot.windowLabel || null,
    snapshot.zoneName ? `(${snapshot.zoneName})` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

/** Persist as midday UTC so the calendar day survives timezone rendering in admin. */
export function toOrderDate(dateISO: string): string {
  return `${dateISO}T12:00:00.000Z`
}
