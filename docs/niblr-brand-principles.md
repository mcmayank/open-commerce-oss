# Niblr — Brand Principles: Ownership & Neutrality

**Purpose.** This is the source of truth for how Niblr talks about ownership,
payments, and lock-in. The pricing page, the marketing site, and the Claude Code
build prompt should all pull their language from here so the story stays one story.
When in doubt, these lines win over ad-hoc feature copy.

> **Canonical location.** This file in the repo is what agents read. A copy exists
> in the Claude project for authoring and sharing. If they disagree, this file wins,
> and the project copy should be updated to match in the same sitting.

---

## The one line

> **Commerce you own. Leave whenever you want — that's exactly why you'll stay.**

Payments sub-line (use on pricing / checkout copy):

> **Niblr never touches your money. Bring any gateway, pay only its rate, keep the rest.
> No platform fee. No penalty. No lock-in.**

---

## The spine: what we don't do to you

Everything Niblr says ladders up to four promises. They are deliberately framed
as things we *refuse to do*, because the category is defined by what platforms
usually take.

1. **We don't take a cut of your sales.** 0% platform transaction fee. Money
   settles directly to you through your own gateway keys. We are not in the flow.
2. **We don't force a payment service on you.** Bring your own gateway — Stripe,
   Razorpay, Tap, Telr, whatever fits your market. Pick the cheapest rail, use
   UPI, add BNPL. Your choice, not ours.
3. **We don't trap your business.** Your domain, your customers, your catalog —
   your orders, products and customer list download as spreadsheets from any
   plan, including Free. The code is open. Self-host and walk away if you want
   to. Nothing is held hostage.
4. **We don't lock you into our ecosystem.** No mandatory apps, no mandatory
   hosting, no penalty for going your own way.

---

## The positioning: the anti-Shopify

Shopify's business model *is* the lock-in. Switching cost is their moat, which is
why they push merchants onto Shopify Payments and make leaving painful. Niblr is
the inverse. We sell the opposite of a trap: freedom to leave as the reason to stay.

This lands hardest with merchants who've felt platform risk — a surprise fee hike,
a deplatforming, a policy change that tanked their store. In the UAE and India,
where Shopify Payments isn't even offered, the story is not just emotional, it's
mathematically true (see claims below).

---

## Approved claims (honest, defensible)

- "Shopify charges UAE merchants an extra **2% on every sale** just for using a
  local gateway. On Niblr that's **zero**." (Basic plan; 1% / 0.6% on higher plans.)
- "Use your own gateway and keep 100% of every negotiated rate improvement as you
  grow. Nobody sits in the middle."
- "Take UPI at near-0% instead of ~2% on cards — because you own the gateway, not us."
- "Own your storefront, your data, and your code. Export your catalog, orders and
  customers anytime, or self-host."

> **Name the three nouns.** The export ships exactly catalog, orders and customers
> (`src/lib/export/`) — not storefront pages, themes, or tax and fulfilment
> settings, and images come as links rather than files. The earlier wording of the
> claim above was an unqualified "export", and that vagueness is what let
> `/open-source` advertise a data export for months while no export code existed
> anywhere in the repo. Never write "export your data" without saying what data.

## Claims to avoid (overstated / easily debunked)

- ❌ "Keep 97% of what you'd have paid in fees." A merchant pays their processor
  (Stripe/Tap/Razorpay) either way. We do **not** save them the card-processing rate.
- ❌ Anything implying Niblr removes the ~2.9% processing cost. We remove Shopify's
  **platform penalty** and margin, not the processor's rate.
- ❌ Universal savings language. The fee advantage is real in Shopify-Payments-absent
  markets (UAE, India) and mostly evaporates in the US/UK. Lead with our markets.

### Verified external figures (checked 25 July 2026, shopify.com/pricing)

Shopify's additional transaction fee for using any gateway other than Shopify
Payments, by plan. This is the ONLY percentage Niblr may present as a saving.

| Shopify plan | Third-party fee | Monthly, billed monthly |
|---|---|---|
| Basic | 2% | $39 |
| Grow | 1% | $105 |
| Advanced | 0.6% | $399 |
| Plus | 0.2% | from $2,300 |

Implemented in `src/lib/pricing/savings.ts` as `SHOPIFY_THIRD_PARTY_FEE`. If you
are about to write `0.029` anywhere near pricing copy or pricing maths, stop and
re-read the avoid list above.

### Open-source claim, current status

The public repo is **`github.com/mcmayank/open-commerce-oss`** (public since 3 Sep 2026,
first release `v1.0.0-oss`). It is the **exported single-store build**, produced from the
private repo on every release tag; the multi-tenant hosting layer, billing and platform
operator tools are not in it. Claim the licence and the single-store build; never imply
that everything the hosted service runs is in the public repo.

- ✅ "MIT-licensed. Self-host the single-store build free, forever."
- ✅ "Read the source." / "Fork it, run it." — linking to the public repo.
- ❌ "Every line we run is on GitHub." / "The hosted platform is open source." The
  multi-store layer is the paid product and is private by design.
- ❌ Linking to `github.com/mcmayank/open-commerce` (the private repo) anywhere public.
  `src/lib/repo.ts` is the only place the URL lives.

---

## Internal principles (not public copy)

**Value lock-in, never hostage lock-in.** We reject holding data to keep people.
We embrace being *genuinely hard to leave because we're good*. Multi-tenancy as the
paid tier is value lock-in: an agency pays because rebuilding it is real work, not
because we trapped them. Pursue all the value lock-in we can earn; zero hostage
lock-in, ever.

**Default, don't dictate.** "We won't force a service on you" must not become "here
are six gateways, good luck." Ship a strong recommended setup per market (Razorpay
for India, Tap or Telr for UAE) that a merchant accepts in one click or overrides if
they care. Freedom with a sensible default. Most take the default and still feel free.

> **Reality check on that default.** Razorpay ships. Neither Tap nor Telr exists in
> `src/payments/providers/` as of 25 July 2026. Do not imply a UAE-native gateway
> until one is registered in `src/payments/core/provider-registry.ts`. The UAE 2%
> argument is true regardless and may be used; the gateway availability may not.

**The model's discipline.** Because we're structurally out of the payment flow, we
earn nothing on payments by design. The subscription carries the whole business, and
our only moat is being worth paying for every month. That's the price of the ethos,
and it's a cleaner game than trapping people.

**Tax is arithmetic, not custody.** Being out of the payment flow means we never
hold merchant money. It does not delegate tax calculation to the gateway: gateways
capture the amount the cart hands them and compute nothing. Because Niblr issues the
invoice, Niblr owes the merchant a correct one. We calculate and document; the
merchant files. Never imply Niblr remits or files anything.
