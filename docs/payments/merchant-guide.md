# Accepting payments (merchant guide)

Niblr uses a **bring-your-own-gateway** model. You connect **your own** payment
provider account; your customers pay through the **provider's** hosted checkout;
the provider settles funds **directly into your bank account**. Niblr records and
reconciles the payment but **never holds your money** and never sees card details.

## What Niblr does and does not store

**Niblr stores:** your order data, a payment "attempt" record (amount, currency,
the provider's session/payment id, status), and your provider **API credentials
encrypted at rest** (AES-256-GCM). Secrets are shown masked and are never
returned by any API or written to logs.

**Niblr never stores:** card numbers, CVV, or any raw cardholder data. All card
entry happens on the provider's hosted page.

## Providers

All hosted providers work the same way: paste your key(s), register the webhook,
enable, done. The customer pays on the provider's page; funds settle to your bank.

- **Stripe** — *secret key* (`sk_…`/`rk_…`) + *webhook signing secret* (`whsec_…`).
- **Razorpay** — *key_id* (`rzp_…`), *key_secret*, and a *webhook secret*.
- **Mollie** (Europe) — a single *API key* (`test_…`/`live_…`). No separate webhook
  secret; the mode is set by the key prefix.
- **Paystack** (Africa) — a single *secret key* (`sk_test_…`/`sk_live_…`); it also
  signs your webhooks, so there's nothing else to paste.
- **Flutterwave** (Africa) — *secret key* (`FLWSECK…`) + a *webhook secret hash*.
- **Xendit** (SE Asia) — *secret API key* (`xnd_…`) + a *webhook verification token*.
- **Offline** — Cash on Delivery / bank transfer. No credentials; you mark these
  orders paid yourself from the Orders screen.

**Don't see your provider?** Use **Request a provider** at the bottom of
Settings → Payments to tell us which one you need — it goes straight to our
roadmap triage.

## Setting up (Settings → Payments)

1. **Open a provider account** and complete their KYC. Pricing, payouts, disputes
   and chargebacks are handled in the provider's dashboard, by you.
2. In Niblr, go to **admin → Payments**.
3. Choose **Test** or **Live** mode and paste the matching credentials. Test keys
   (`sk_test_…` / `rzp_test_…`) only work in Test mode, and live keys only in Live
   mode — the connection test flags a mismatch.
4. Click **Save**, then **Test connection**. This is read-only — it never creates
   a charge. It reports: connected, invalid credentials, wrong-mode key, account
   restricted, or "cannot reach provider".
5. **Register the webhook.** Copy the **Webhook URL** shown on the card into your
   provider dashboard's webhook settings, and paste the webhook secret back into
   Niblr. The webhook is what actually confirms payments — without it, orders stay
   pending.
6. Tick **Enabled** and Save. The provider now appears at checkout (when the order
   currency is supported).

### ⚠️ Razorpay: turn on Auto-Capture

In your Razorpay dashboard, **Settings → Payment Capture**, ensure **automatic
capture** is on. If it is off, payments are only *authorized* — the money looks
received but silently auto-refunds after a few days, and Niblr will **not** fulfil
the order (it keeps it pending and records the payment as "authorized"). The
connection test warns you about this.

## Test vs Live

- **Test** lets you run the whole flow with the provider's test cards — no real
  money moves. Use it to verify checkout end-to-end before going live.
- **Live** uses real credentials and real money. Switch the mode toggle and paste
  live credentials + a live webhook secret.

## How a payment is confirmed

Reaching the "Thank you" page does **not** mean you've been paid — it just means
the customer returned from the provider. Niblr confirms the order **only** when the
provider's **webhook** arrives and Niblr re-fetches the payment from the provider
and checks the amount and currency match. That's why the confirmation page shows
"Confirming your payment…" until the webhook lands.

## Refunds & disputes

Issue refunds and handle disputes/chargebacks from your **provider's dashboard**.
Niblr observes refunds for reporting but does not initiate them.

## Payouts

Payouts go from the provider **directly to your bank account** on the provider's
schedule. Niblr is not in the money path and takes no cut of your sales.
