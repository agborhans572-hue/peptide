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

`npm run build` regenerates the reviewed server catalog, responsive/social product images, sitemap/robots files, and route-specific HTML shells. `npm run check` runs catalog validation, strict TypeScript, zero-warning ESLint, server-pricing tests, the production build, and a client-secret scan. `release:check` also audits dependencies and smoke-tests the built artifact in Chrome across desktop and mobile routes.

Use `.env.example` locally and configure production values from `.env.production.example` in the host's encrypted secret store. All `VITE_*` values are public browser configuration and must never contain secrets. Apply all Supabase migrations in timestamp order before enabling accounts or checkout. Configure Turnstile, email confirmation, custom SMTP, exact production redirects, rate limits, and session limits as described in `supabase/README.md`.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting rules, service endpoint contracts, the legacy COA/legal-route cutover requirement, and the complete release checklist.

## Vercel

Import this GitHub repository in Vercel and leave the detected Vite settings in place. The committed `vercel.json` builds `dist/`, serves the account, checkout, webhook, order-tracking, and client-error endpoints, and runs the daily account-deletion cron. Add the production variables listed in `.env.production.example`; mark service, cron, Stripe, WooCommerce, and monitoring values as sensitive.
