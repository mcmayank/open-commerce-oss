import { currencyExponent, formatMoney, toMinor } from '@/lib/money'

export type Tone = 'positive' | 'info' | 'warning' | 'neutral' | 'danger'

const TONES: Record<string, Tone> = {
  paid: 'positive',
  delivered: 'positive',
  shipped: 'info',
  pending: 'warning',
  cancelled: 'neutral',
  refunded: 'danger',
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function statusMeta(status: string): { label: string; tone: Tone } {
  return { label: cap(status), tone: TONES[status] ?? 'neutral' }
}

export function itemCount(lineItems?: Array<{ qty?: number | null }> | null): number {
  return (lineItems ?? []).reduce((n, li) => n + (li.qty ?? 0), 0)
}

export interface TimelineRow {
  key: string
  title: string
  detail?: string
  when: string
}

export function timelineRows(order: {
  createdAt?: string | null
  paidAt?: string | null
  invoiceSentAt?: string | null
  invoiceNumber?: string | null
}): TimelineRow[] {
  const rows: TimelineRow[] = []
  if (order.invoiceSentAt) {
    rows.push({ key: 'invoice', title: `Invoice ${order.invoiceNumber ?? ''} emailed`.trim(), when: order.invoiceSentAt })
  }
  if (order.paidAt) rows.push({ key: 'paid', title: 'Payment captured', when: order.paidAt })
  if (order.createdAt) rows.push({ key: 'placed', title: 'Order placed', when: order.createdAt })
  return rows.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
}

// ── Refund amount entry ───────────────────────────────────────────────
//
// The merchant types a MAJOR-unit amount ("12.50"); everything downstream is
// integer minor units. This is a UI convenience only — the server re-decides
// every one of these rules in `decideRefund` before a gateway is called, so a
// merchant who bypasses the form gains nothing.

export type RefundAmountResult = { ok: true; minor: number } | { ok: false; error: string }

export function parseRefundAmount(
  input: string,
  currency: string,
  remainingMinor: number,
): RefundAmountResult {
  const raw = input.trim().replace(/,/g, '')
  if (!raw) return { ok: false, error: 'Enter an amount to refund.' }

  if (!/^\d*\.?\d*$/.test(raw)) return { ok: false, error: 'Enter a plain number, e.g. 12.50.' }

  const major = Number(raw)
  if (!Number.isFinite(major) || major <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' }
  }

  // Reject amounts finer than the currency's minor unit rather than silently
  // rounding them — the merchant should see exactly what leaves their account.
  const exp = currencyExponent(currency)
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
  if (decimals > exp) {
    return {
      ok: false,
      error:
        exp === 0
          ? `${currency.toUpperCase()} amounts have no decimal places.`
          : `${currency.toUpperCase()} amounts have at most ${exp} decimal places.`,
    }
  }

  const minor = toMinor(major, currency)
  if (minor > remainingMinor) {
    return {
      ok: false,
      error: `That is more than the ${formatMoney(remainingMinor, currency)} left on this order.`,
    }
  }
  return { ok: true, minor }
}
