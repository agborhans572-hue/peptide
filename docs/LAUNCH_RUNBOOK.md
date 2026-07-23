# Production launch runbook

The repository now contains the application-side controls for the launch gate. Account-level controls must be completed in the named production services before traffic is enabled.

## Environment separation

Create three different Supabase projects: development, staging, and production. Never reuse a database URL or service-role key across them. Use Stripe test mode for development/staging and Stripe live mode only in the production deploy context. Store all server secrets in the hosting provider's encrypted environment store; do not create a committed `.env.production` file.

The production build runs `npm run deploy:build`. It fails unless HTTPS, Supabase, Stripe live, webhook signing, and monitoring variables are present. `serverEnv()` also refuses a live Stripe key outside production and refuses a test key in production.

## Apply and verify Supabase

For each project, authenticate with the Supabase CLI, link the intended project, inspect the diff, and apply migrations:

```bash
supabase login
supabase link --project-ref YOUR_ENVIRONMENT_PROJECT_REF
supabase db diff --linked
supabase db push --dry-run
supabase db push
supabase migration list
```

Do this from separate environment-specific working copies or relink deliberately and verify the project ref before every push. Production must show all three committed migrations, including `202607230001_customer_accounts.sql`, in both local and remote migration columns. Run `npm run test:accounts:db` against the disposable local stack before applying the account migration.

Run the following in the production SQL editor after deployment. The first query must return zero rows for every application table exposed through the public API; the bucket must be private; and no policy may grant `anon` order access.

```sql
select relname as exposed_table_without_rls
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind in ('r', 'p')
  and not relrowsecurity;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'order-documents';

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

## Customer authentication

1. Set the Auth Site URL to `https://purehealthpeptidesshop.com` and allow only the exact callback and password-reset routes.
2. Enable confirmed email signup, double-confirmed email changes, secure password changes, one-hour link expiry, 60-second resend frequency, and a 12-character password minimum.
3. Configure custom SMTP, disable link tracking, and test verification, recovery, email-change, expired-link, and already-used-link paths.
4. Enable Cloudflare Turnstile and keep sign-in/sign-up and token-verification limits at 30 requests per five minutes per IP.
5. Configure 15-minute JWTs, refresh-token rotation, a 12-hour inactivity timeout, and a seven-day session time-box.
6. Leave Google disabled unless its credentials, callbacks, existing-email linking, and logout pass staging.
7. Confirm Vercel has `CRON_SECRET`, invoke the deletion processor once with no eligible rows, and verify an unauthorized request receives 401.

## Stripe live configuration

1. Put `STRIPE_SECRET_KEY=sk_live_...` only in the production server environment.
2. Register `https://purehealthpeptidesshop.com/api/stripe-webhook` in Stripe Workbench.
3. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.payment_failed`, and `charge.refunded`.
4. Put that endpoint's `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.
5. Confirm Stripe's business profile, statement descriptor, support contacts, terms URL, privacy URL, refund policy, and payout bank account.
6. Send a live webhook test and confirm an HTTP 200 plus one row in `stripe_events`.

The checkout accepts only product IDs, option labels, and quantities. Prices, discounts, availability, and shipping are recalculated from `server/catalog.generated.json` on the server. Orders begin blocked. Only a signed paid Stripe event moves an order to `payment_status=paid` and `fulfillment_status=ready`. The database constraint and `mark_order_fulfilled` function reject fulfillment of unpaid orders. The Stripe event ID primary key makes webhook processing idempotent.

## Real payment and refund test

After the production deploy and webhook are green, buy the lowest-value eligible item with an authorized real card. Record the order number, Checkout Session, PaymentIntent, Stripe event IDs, Supabase order state, confirmation page, alert delivery, and fulfillment state. Do not ship the test order. Refund it in Stripe, verify `charge.refunded` returns HTTP 200, and confirm the order becomes `refunded` and `cancelled`. Save evidence without card data or secrets.

## Backups and restore drill

Enable a Supabase plan with production backups and Point-in-Time Recovery appropriate to the business recovery objectives. Record the backup window and retention. At least quarterly, restore the latest production backup into a new isolated project, apply no new writes, compare order counts/checksums, verify a sample order and its items, record recovery time, then destroy the isolated restore after approval. Never test restores over the production project.

## Admin security

Require MFA for the organization owner, Supabase, Stripe, hosting, domain registrar, DNS/CDN, monitoring, and support inbox. Use individual accounts, phishing-resistant security keys where supported, password-manager-generated unique passwords, least privilege, and two break-glass accounts stored offline. Review active users and recovery methods before launch and quarterly.

## HTTPS, monitoring, and alerts

Issue the certificate before DNS cutover. Verify the canonical hostname and redirect hostname with an external TLS checker, then confirm HSTS and the headers in `public/_headers`. Configure `MONITORING_WEBHOOK_URL` to the production incident destination and create alerts for function errors, payment failures, refunds, Stripe endpoint delivery failures, elevated 5xx rate, and failed deploys. Test every alert before launch.

## Legal and operational review

Shipping, refund, privacy, and terms pages are part of the static build. Business/legal owners must approve their text, effective date, contact address, tax treatment, refund rules, research-use restrictions, and jurisdiction before production traffic.

## Rollback

Before deployment, record the currently serving deploy ID and database migration state. If the release fails, stop checkout by removing `VITE_CHECKOUT_ENDPOINT` or disabling the site deploy, restore the previous immutable frontend/functions deploy, and leave paid orders untouched. Database migrations are additive; do not run destructive down migrations during an incident. If data repair is required, clone production from backup, validate a forward repair, obtain approval, and apply the audited repair to production. Re-deliver failed Stripe events only after the webhook and database state are verified.
