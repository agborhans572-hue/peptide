# Scalability implementation and rollout

## Delivered architecture

WooCommerce is the authority for product visibility, live price, inventory reservations, and operational orders. Stripe remains the payment host. Supabase stores the customer-facing projection, the durable Stripe inbox, and leased retry/reconciliation jobs. Vercel Pro runs the commerce worker every minute.

The browser sends only `checkoutAttemptId`, `catalogVersion`, product ID, variant ID, and quantity. The server prices the cart, makes one signed reservation request to WooCommerce, creates an idempotent Stripe Checkout session, and stores the Woo/Stripe references in Supabase. Checkout fails closed when reservations are disabled, the bridge is unavailable, or payment-event lag exceeds five minutes.

## Code changes

- `supabase/migrations/202608140001_scalable_commerce.sql` adds order synchronization fields, the Stripe inbox, leased commerce jobs, leased account deletion, reconciliation/expiry/cleanup functions, cursor order pagination, indexes, RLS, and the public `product-media` bucket.
- `woocommerce/pure-health-commerce-bridge/` contains the HPOS-compatible plugin. It validates catalog state, totals, variations, and stock; signs requests with rotating HMAC secrets; prevents nonce replay; creates an idempotent checkout-draft order; and uses WooCommerce's locked reserved-stock implementation.
- `/api/checkout` uses one authoritative reservation call and a stable UUID idempotency key. `/api/stripe-webhook` persists before processing. `/api/woocommerce-webhook` projects Woo order changes. `/api/orders/status` reads only the indexed local projection.
- `/api/cron/process-commerce-jobs` claims at most 100 records using database leases, processes five concurrently, releases expired holds, retries Stripe events, reconciles recent Woo orders, and cleans old rate-limit/event data.
- Account deletion claims 100 leased records per run and processes five concurrently while retaining active-order and legal-hold checks.
- React Router owns browser history. Page modules and CSS are lazy, Supabase auth is initialized dynamically, carts persist only stable identifiers, shop/COA pages paginate at 24, account orders use a 20-row cursor, and product/COA details are immutable on-demand documents.
- `catalog:publish` is the only catalog/SEO/image generation workflow. `build` is read-only. Product image keys use file content, not modification time. CI enforces a 1,800-route budget.
- `media:publish -- --apply` uploads and verifies content-addressed media in Supabase Storage with one-year caching and emits the client manifest. Local URLs remain the fallback until the two-deployment migration gate passes.

## Required deployment sequence

1. Use Vercel Pro and Supabase Pro in the closest common region. Apply every Supabase migration to staging.
2. Install the Woo bridge in staging. Set `PHP_COMMERCE_BRIDGE_SECRET` in `wp-config.php`, matching `WOO_BRIDGE_SECRET_CURRENT`. Keep `COMMERCE_RESERVATIONS_ENABLED=false`.
3. Register Stripe at `/api/stripe-webhook`. Register a Woo order webhook at `/api/woocommerce-webhook` using `WOO_WEBHOOK_SECRET`. Set `CRON_SECRET` for both Vercel cron routes.
4. Run the server/component/pgTAP/browser suites, then the stock-10/50-concurrent-attempt test and the 100/minute load test. Confirm exactly ten reservations and no oversell.
5. Upload media with `npm run media:publish -- --apply`. Deploy the generated manifest while keeping local assets for two production deployments. Remove local binaries only after checksum and CDN-miss verification.
6. Deploy production schema and plugin disabled. Enable staff, then 5%, 25%, and 100%. Watch checkout latency, reservation errors, Stripe inbox age, dead jobs, and Woo/Supabase mismatches.
7. Configure Vercel Firewall coarse request limits. Keep the database checkout limiter for application-specific enforcement.
8. Keep Netlify compatibility during the 14-day rollback window. Remove its adapters/configuration only after Vercel routes, headers, crons, webhooks, and rollback behavior have production evidence.

Rollback disables new checkout by setting `COMMERCE_RESERVATIONS_ENABLED=false`; it does not restore the unsafe legacy checkout. Workers and webhooks must remain enabled until all reservations and Stripe events reach terminal states.

## Acceptance gates

- Checkout p95 below four seconds and p99 below eight seconds at 100 starts/minute; 200/minute burst passes.
- Stripe webhook p95 below three seconds; oldest retryable job below two minutes in healthy operation.
- Exactly one Woo reservation request and no duplicate Woo/Supabase order per checkout attempt.
- Initial non-commerce JavaScript no more than 160 KB gzip; shop/product no more than 220 KB gzip; product routes load only their own detail document.
- Application artifact below 15 MB after the external media cutover; 1,000-product clean build below 90 seconds and catalog publication below five minutes.

The media upload, production secret configuration, Woo plugin activation, provider firewall rules, and staged traffic/load tests are external rollout actions and intentionally are not simulated by the repository build.

## Local verification (2026-08-14)

- `npm run check`: passed, including catalog validation, type checking, lint, 20 server tests, 5 component tests, a clean Vite build, bundle budgets, SEO QA, and client-secret scanning.
- `npm run qa:browser:release`: passed for shop pagination, all 115 product routes, responsive image/layout checks, support/content routes, and paginated/on-demand COA behavior.
- Dependency audit: zero known vulnerabilities at the configured severity gate.
- Build: 9.19 seconds; initial JavaScript 112.5 KB gzip, shop 123.7 KB, product 123.5 KB; route budget 174/1,800.
- Current `dist` remains 66.26 MB because the required two-deployment media fallback has not yet begun. Application JavaScript/CSS is 0.97 MB, catalog data is 1.28 MB, and COA data is 0.11 MB.
- pgTAP, Woo PHPUnit/PHP syntax checks, and k6 staging load/concurrency tests require Docker, PHP, k6, and connected staging services; those executables/services are not available in this workspace and remain deployment gates.
