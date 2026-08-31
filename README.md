# Pure Health Peptides rebuild

A production-optimized React/Vite storefront for Pure Health Peptides. It includes the 115-product catalog, verified Supabase customer accounts, server-priced Stripe Checkout, Supabase order persistence, verified/idempotent payment webhooks, protected order tracking, legal pages, and the original content experience.

## Local development

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run dev
```

The development server uses `http://127.0.0.1:5173` by default. Start it on the QA port with `npm run dev -- --port 4173` before running `npm run qa`.

## Production build

```bash
npm run build
# or run the complete dependency/build/browser release gate:
npm run release:check
```

`npm run build` is read-only and reproducible. Run `npm run catalog:publish` only when publishing a reviewed catalog; it generates the catalog, content-addressed images, SEO files, immutable product/COA documents, and validates the route budget. `npm run check` runs validation, TypeScript, authored-source linting, server and React component tests, the production build, SEO checks, and a client-secret scan. `release:check` adds dependency audit, pgTAP, and production browser smoke tests.

Use `.env.example` locally and configure production values from `.env.production.example` in the host's encrypted secret store. All `VITE_*` values are public browser configuration and must never contain secrets. Apply all Supabase migrations in timestamp order before enabling accounts or checkout. Configure Turnstile, email confirmation, custom SMTP, exact production redirects, rate limits, and session limits as described in `supabase/README.md`.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting rules and [SCALABILITY_IMPLEMENTATION.md](./SCALABILITY_IMPLEMENTATION.md) for architecture, rollout, rollback, and acceptance gates.

## Vercel

Import this repository on Vercel and leave the detected Vite settings in place. The committed `vercel.json` builds `dist/`, serves commerce/account endpoints, and runs both the commerce worker and account-deletion worker daily so the schedules are compatible with Vercel Hobby. Add the production variables listed in `.env.production.example`; mark service, cron, Stripe, and WooCommerce values as sensitive.
