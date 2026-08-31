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

## Vercel deployment

Vercel is the supported deployment path. In the Vercel dashboard, choose **Add New → Project**, import `agborhans572-hue/peptide`, and deploy the `main` branch. The repository supplies the Vite build command, `dist` output directory, and Vercel serverless routes through `vercel.json`; do not override them.

In **Project → Settings → Environment Variables**, add these values for the **Production** environment before enabling checkout:

| Key | Value source | Sensitive |
| --- | --- | --- |
| `APP_ENV` | `production` | No |
| `SITE_URL` | Your final `https://` production domain | No |
| `SUPABASE_URL` | Supabase Project Settings → API → Project URL | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-side secret/service-role key | Yes |
| `CRON_SECRET` | At least 32 random characters for the deletion processor | Yes |
| `STRIPE_SECRET_KEY` | Stripe live secret key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe endpoint signing secret | Yes |
| `RESEND_API_KEY` | Resend sending-access API key | Yes |
| `CONTACT_FROM_EMAIL` | `info@purehealthpeptidesshop.com` on the verified sending domain | No |
| `WOOCOMMERCE_URL` | WooCommerce store URL | No |
| `WC_CONSUMER_KEY` | WooCommerce REST API key | Yes |
| `WC_CONSUMER_SECRET` | WooCommerce REST API secret | Yes |
| `COMMERCE_RESERVATIONS_ENABLED` | `false` until staged acceptance; then `true` | No |
| `WOO_BRIDGE_SECRET_CURRENT` | Same 32+ character value as the Woo plugin | Yes |
| `WOO_BRIDGE_SECRET_PREVIOUS` | Previous value during secret rotation only | Yes |
| `WOO_WEBHOOK_SECRET` | Woo order webhook signing secret | Yes |
| `VITE_SITE_URL` | Same final `https://` production domain | No |
| `VITE_SUPABASE_URL` | Same project URL as `SUPABASE_URL` | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase browser publishable key | No |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key | No |
| `VITE_GOOGLE_AUTH_ENABLED` | `false` unless Google is configured and tested | No |
| `VITE_ACCOUNT_DELETION_ENDPOINT` | `/api/account/delete-request` | No |
| `VITE_CHECKOUT_ENDPOINT` | `/api/checkout` | No |
| `VITE_CONTACT_ENDPOINT` | `/api/contact` | No |
| `VITE_ORDER_TRACKING_ENDPOINT` | `/api/orders/track` | No |
| `VITE_BUILD_SOURCEMAP` | `false` | No |

Never add a secret as `VITE_*`: Vite embeds those values in the browser bundle. Once Vercel has assigned your final domain, set Stripe’s live webhook endpoint to `https://YOUR-DOMAIN/api/stripe-webhook` and copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Vercel Pro is required for the one-minute commerce cron. Set Stripe's endpoint to `https://YOUR-DOMAIN/api/stripe-webhook` and Woo's order endpoint to `https://YOUR-DOMAIN/api/woocommerce-webhook`; keep both secrets server-only.

## Hosting requirements

- Serve `dist/` as the site root over HTTPS.
- Preserve existing files and directory indexes. Vercel serves the generated static route shells and the committed `/api/` functions directly.
- A same-domain cutover must preserve or origin-route `/wp-content/uploads/` before the SPA fallback: the COA library currently links to 640 existing PDF URLs under that path. Preserve the live `/disclaimer/` and `/waiver-agreement-policy/` pages referenced by the footer. Shipping, refund, privacy, and terms pages are emitted by this application.
- Apply the policies in `_headers`. Hosts that do not consume this portable headers format must map the same headers in their dashboard, CDN, or web-server configuration.
- Keep HTML revalidated, cache `/_app/` for one year because those files are content-hashed, and cache the stable `/assets/` paths for no more than the included seven-day window.
- Redirect the non-canonical hostname to `https://purehealthpeptidesshop.com` and issue a valid TLS certificate before enabling traffic.

## Release checks

1. Test a direct page load and refresh on `/shop/`, one `/product/.../` URL, and every `/coa-library/.../` category.
2. Verify that external COA PDF links still open from `purehealthpeptides.com`.
3. Validate response headers, the sitemap, social previews, keyboard navigation, mobile layouts, and the research-use confirmation flow.
4. Confirm analytics, consent, monitoring, error reporting, backups, and an incident contact in the production environment if those services are required.
5. Purge the CDN after deployments that change a fixed-name file under `/assets/`.

## Store service connections

The repository includes Vercel serverless adapters for server-priced Stripe Checkout, signed/idempotent Stripe webhooks, Supabase orders, and protected order lookup. Apply the Supabase migration and configure the server-only secrets documented in `.env.production.example` before enabling checkout. Public endpoint variables are configured at build time:

- `VITE_ACCOUNT_DELETION_ENDPOINT` accepts a recent authenticated deletion request and immediately disables protected access.
- `VITE_CHECKOUT_ENDPOINT` accepts `POST { checkoutAttemptId, catalogVersion, items: [{ productId, variantId, quantity }] }` and returns `{ checkoutUrl, orderNumber, expiresAt }`. It sends one signed reservation request to the Woo bridge and never accepts browser prices/SKUs/totals. A stale cart receives HTTP 409; an unavailable authority fails closed with retryable HTTP 503.
- `VITE_CONTACT_ENDPOINT` points to `/api/contact`, which validates and rate-limits `POST { fullName, email, message }`, then delivers the enquiry only to `info@purehealthpeptidesshop.com` through Resend. Verify `purehealthpeptidesshop.com` in Resend and configure `RESEND_API_KEY` plus `CONTACT_FROM_EMAIL` in the server-side deployment environment.
- `VITE_NEWSLETTER_ENDPOINT` accepts `POST { email }`.
- `VITE_ORDER_TRACKING_ENDPOINT` accepts `POST { orderid, order_email }` and may return a user-safe `message` or `status`.

Keep these endpoints same-origin under the included Content Security Policy and never put secrets in `VITE_*` variables. WooCommerce REST credentials, Supabase service-role credentials, and Stripe keys are server-only. Apply all migrations so customer ownership and order snapshots are preserved. Fulfillment operations, transactional email, analytics/consent, production monitoring, backups, admin MFA, and live payment/refund verification still require account-level setup and operational ownership.

## Customer authentication

In production Supabase, set the Site URL to `https://purehealthpeptidesshop.com` and allow only `/auth/callback/` and `/auth/reset-password/` on that origin. Enable confirmed email signup, double-confirmed email changes, secure password changes, custom SMTP with link tracking disabled, one-hour link expiry, a 60-second resend interval, and a 12-character minimum password.

Enable Cloudflare Turnstile and keep sign-in/sign-up and token-verification limits at 30 per five minutes per IP. On Supabase Pro, configure 15-minute JWTs, refresh-token rotation, a 12-hour inactivity timeout, and a seven-day session time-box. Google remains disabled unless its credentials and callbacks are staging-tested.

Vercel invokes `/api/cron/process-commerce-jobs` every minute and `/api/cron/process-account-deletions` daily with `CRON_SECRET`. Both use bounded database leases so duplicate cron invocations do not duplicate work. Deletion waits 30 days, defers active orders/legal holds, anonymizes retained financial orders, and removes the Auth user.

See `docs/LAUNCH_RUNBOOK.md` for database migration verification, Stripe webhook registration, live payment/refund evidence, backups, MFA, HTTPS, monitoring, legal approval, and rollback.

The Content Security Policy intentionally permits scripts and network requests only from the same origin, allows inline styles for React's dynamic product layout, and allows images from this site plus the canonical Pure Health Peptides origin. Update and retest the policy before adding analytics, payment, chat, embedded content, or external APIs.
