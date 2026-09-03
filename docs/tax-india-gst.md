# Indian GST — what a real implementation needs

**Status:** scoped, NOT built. Nothing in the codebase implements any of this.
**Written:** 25 July 2026, alongside ACTION-PLAN 1.2 (UAE-shaped VAT).

---

## Why this file exists

1.2 shipped a **single-rate, UAE-shaped** tax implementation: one rate, one
registration number, inclusive or exclusive, snapshotted onto the order and
printed on the invoice. That is correct and sufficient for the UAE.

It is **not** GST, and India is one of Niblr's two primary markets. This file
exists so nobody looks at `src/lib/tax.ts`, sees tax working, and assumes an
Indian merchant is covered. Shipping a half-correct GST invoice is worse than
shipping none — a wrong GST invoice is a compliance problem for the merchant,
not a cosmetic bug.

## What 1.2 already gives an Indian merchant

Genuinely useful, and not nothing:

- a single rate applied and shown correctly, inclusive by default (the norm)
- the amount extracted rather than added, so listed prices hold
- the figure snapshotted onto the order and printed on the invoice

What it does **not** give: a document the merchant can file against.

## The gaps

### 1. GSTIN on the store, not just a TRN

`StoreSettings.tax.registrationNumber` is a free-text field validated only as
non-empty. A GSTIN is 15 characters with structure: two-digit state code, ten
character PAN, entity number, a fixed `Z`, and a checksum. The state code
matters beyond validation — it is what determines intra- vs inter-state supply
(below), so it has to be parsed, not just stored.

### 2. HSN / SAC codes per product

Every line on a GST invoice carries the HSN code for goods, or SAC for
services. This is a new product field, and for a bakery it is per-item rather
than per-store — a croissant and a gift card are not the same code.

### 3. CGST/SGST vs IGST — the structural difference

This is the part with no equivalent in the UAE model. A single `taxAmount` on
the order cannot represent it.

- **Intra-state** (supplier and place of supply in the same state): the rate
  splits in half into **CGST** and **SGST**, shown as two separate lines.
- **Inter-state**: a single **IGST** line at the full rate.

An 18% supply is `9% CGST + 9% SGST` or `18% IGST` depending on where the buyer
is. Same total, different document — and the wrong split is a filing error.

So the order needs a tax **breakdown**, not a scalar: something like
`taxLines: [{ kind: 'cgst' | 'sgst' | 'igst', rate, amountMinor }]`, snapshotted
the same way. That is a schema change, and it is the reason this is its own
project rather than a flag on the existing one.

### 4. Place-of-supply logic

Driven by the shipping address, not the billing address, and not the store's
own state. `orders.ts` currently passes a `taxableBaseMinor` and nothing else;
GST needs the destination state to pick the split above. Edge cases that need a
decision, not a guess: no shipping address (digital goods), a shipping state
that is a union territory, and exports (zero-rated, with their own paperwork).

### 5. The invoice itself

A GST tax invoice needs both parties' GSTIN for B2B, the place of supply
stated explicitly, HSN/SAC per line, and the CGST/SGST/IGST split shown
separately. B2C above a threshold has its own requirements again.

`invoicing/pdf.tsx` currently renders one optional tax row. It would need a tax
table, and `isTaxInvoice` would need to mean something more specific than "a
registration number exists".

## Scope guidance

Do not extend `src/lib/tax.ts` to cover this. Its contract — one rate in, one
amount out — is right for the UAE and wrong for GST, and bending it would make
both harder to reason about. GST wants its own module returning a breakdown,
with the order carrying tax lines rather than a scalar.

The UAE implementation should keep working untouched throughout; a store is in
one regime or the other, decided by the registration type, not both.

## Not in scope even then

Niblr calculates and documents. It does not file. GSTR-1 / GSTR-3B returns,
e-invoicing / IRN registration with the government portal, and e-way bills are
all the merchant's, and none of them should be read as implied by "GST support".

---

**ROADMAP row:** `India GST invoicing | Tax | Free | P2 | Medium-High | Not started`
