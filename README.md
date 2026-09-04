# Niblr

Open-source, single-store commerce on Next.js 16 and Payload 3, with Postgres.
You own the storefront, the payment keys, the data and the code. Niblr takes
0% of your sales and is never in the payment flow: bring any gateway, pay only
its rate, keep the rest.

This repository is the self-hosted, single-store build. It is exported from
the private repository that runs the hosted service at [niblr.store](https://niblr.store),
so the storefront, admin, checkout, invoicing, tax, exports, page builder,
themes and the MCP server here are the same code merchants use there. What is
not here is the multi-tenant hosting layer, billing and the platform
operator tools, which only make sense for a hosted service.

## Run it

Requirements: Node 22, pnpm 10, Postgres 15 or later.

```bash
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL and PAYLOAD_SECRET
pnpm payload migrate
pnpm dev
```

Open `http://localhost:3000/admin` to create the first admin user, then set
up your store name, currency and a payment gateway under Settings.

## Deploying

See [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md) and [docs/DEPLOY.md](docs/DEPLOY.md).
Vercel plus a managed Postgres is the path we test; anything that runs a
Next.js server and reaches Postgres works.

## Payments and tax

Payment adapters live in `src/payments/providers/`. Razorpay and Stripe ship
today; adding a gateway is one adapter file registered in
`src/payments/core/provider-registry.ts`. Niblr calculates and documents tax on
the invoice it issues; it never remits or files anything.

## Contributing

Issues and pull requests are welcome. This repository is produced by an
export from the private repo on each release, so a merged contribution is
ported there and lands in the next release rather than being merged here
directly.

## Licence

MIT. See [LICENSE](LICENSE).
