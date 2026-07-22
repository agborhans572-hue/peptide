# Production deployment

This project builds to a static `dist/` directory and can be hosted on any HTTPS-capable static host or CDN.

## Build and verify

Use Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run release:check
```

The build emits route-specific HTML shells for every public page and all 115 product URLs. These shells provide unique titles, descriptions, canonical URLs, and social metadata while React handles the interactive experience. `my-account` and order-tracking shells are marked `noindex` and excluded from the sitemap.

Before release, run the QA commands listed in `package.json` against the preview server. Confirm that `dist/robots.txt`, `dist/sitemap.xml`, `dist/_headers`, and `dist/_redirects` were copied into the artifact.

## Hosting requirements

- Serve `dist/` as the site root over HTTPS.
- Preserve existing files and directory indexes, then rewrite unknown routes to `/index.html` with HTTP 200. The included `_redirects` supports Netlify and Cloudflare Pages; configure the equivalent fallback on other hosts.
- A same-domain cutover must preserve or origin-route `/wp-content/uploads/` before the SPA fallback: the COA library currently links to 640 existing PDF URLs under that path. Preserve the live `/disclaimer/` and `/waiver-agreement-policy/` pages referenced by the footer. Shipping, refund, privacy, and terms pages are emitted by this application.
- Apply the policies in `_headers`. Hosts that do not consume this portable headers format must map the same headers in their dashboard, CDN, or web-server configuration.
- Keep HTML revalidated, cache `/_app/` for one year because those files are content-hashed, and cache the stable `/assets/` paths for no more than the included seven-day window.
- Redirect the non-canonical hostname to `https://purehealthpeptides.com` and issue a valid TLS certificate before enabling traffic.

## Release checks

1. Test a direct page load and refresh on `/shop/`, one `/product/.../` URL, and every `/coa-library/.../` category.
2. Verify that external COA PDF links still open from `purehealthpeptides.com`.
3. Validate response headers, the sitemap, social previews, keyboard navigation, mobile layouts, and the research-use confirmation flow.
4. Confirm analytics, consent, monitoring, error reporting, backups, and an incident contact in the production environment if those services are required.
5. Purge the CDN after deployments that change a fixed-name file under `/assets/`.

## Store service connections

The repository includes Netlify Functions for server-priced Stripe Checkout, signed/idempotent Stripe webhooks, Supabase orders, and protected order lookup. Apply the Supabase migration and configure the server-only secrets documented in `.env.production.example` before enabling checkout. Public endpoint variables are configured at build time:

- `VITE_ACCOUNT_PORTAL_URL` redirects login, OTP, and registration actions to an approved account portal.
- `VITE_CHECKOUT_ENDPOINT` accepts `POST { catalogVersion, items: [{ productId, variantId, quantity }] }` and returns a Stripe-hosted `checkoutUrl`. The included function ignores all browser prices/SKUs/totals, recalculates from the reviewed snapshot, and revalidates price, publication, visibility, and stock against authenticated WooCommerce immediately before creating Stripe Checkout. A stale cart receives HTTP 409; WooCommerce failure is closed with HTTP 503.
- `VITE_CONTACT_ENDPOINT` accepts the contact form fields as JSON.
- `VITE_NEWSLETTER_ENDPOINT` accepts `POST { email }`.
- `VITE_ORDER_TRACKING_ENDPOINT` accepts `POST { orderid, order_email }` and may return a user-safe `message` or `status`.

Keep these endpoints same-origin under the included Content Security Policy and never put secrets in `VITE_*` variables. WooCommerce REST credentials, Supabase service-role credentials, and Stripe keys are server-only. Apply both migrations so order items preserve immutable product/variant/SKU/price/logistics snapshots. Fulfillment operations, transactional email, analytics/consent, production monitoring, backups, admin MFA, and live payment/refund verification still require account-level setup and operational ownership.

See `docs/LAUNCH_RUNBOOK.md` for database migration verification, Stripe webhook registration, live payment/refund evidence, backups, MFA, HTTPS, monitoring, legal approval, and rollback.

The Content Security Policy intentionally permits scripts and network requests only from the same origin, allows inline styles for React's dynamic product layout, and allows images from this site plus the canonical Pure Health Peptides origin. Update and retest the policy before adding analytics, payment, chat, embedded content, or external APIs.
