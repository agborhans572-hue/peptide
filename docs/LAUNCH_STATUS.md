# Launch status

Updated July 20, 2026.

## Verified in this repository

- `npm run check` passes: strict TypeScript, ESLint with zero warnings, pricing tests, production build, and client-secret scan.
- `npm audit --audit-level=high` reports zero vulnerabilities.
- The production smoke test passes desktop/mobile application routes, including shipping, refund, privacy, and terms pages.
- Production builds disable source maps unless explicitly enabled.
- Browser checkout inputs contain no trusted price or total fields. The server reconstructs all prices and shipping from the generated catalog.
- Stripe webhook bodies are signature verified. Stripe event IDs are unique and transactionally claimed before order state changes.
- Orders start fulfillment-blocked. Only the paid webhook RPC moves them to ready, and the database rejects fulfilled orders unless payment status is paid.
- The Supabase migration enables RLS and revokes browser roles on every application table it creates.
- The order-document storage bucket is private and its policies require an authenticated admin role.
- The service-role key, Stripe secret, and webhook secret are server-only; the production artifact secret scan passes.
- Production deployment fails closed without live Stripe, Supabase, HTTPS site, webhook, and monitoring configuration.
- Additive rollback, database restore drill, alerting, MFA, and payment/refund procedures are documented in `LAUNCH_RUNBOOK.md`.

## Must be completed in production accounts

- Create and verify separate development, staging, and production Supabase projects.
- Link the production Supabase project and apply/verify migration `202607200001_launch_commerce.sql`.
- Configure production Supabase and Stripe secrets in the deployment secret store.
- Register and test the live Stripe webhook endpoint.
- Enable Supabase backups/PITR and complete a restore drill.
- Require MFA and strong unique credentials for every production administrator.
- Configure the monitoring webhook and prove application, payment-failure, refund, webhook-delivery, and deployment alerts.
- Obtain business/legal approval for the published policy text.
- Deploy behind the production domain, confirm the new artifact's HTTPS/security headers, and test hostname redirects.
- Complete and document one authorized low-value live payment and full refund.
- Record the previous deploy ID and conduct a rollback rehearsal before launch.

Do not enable production checkout until every production-account item above has evidence attached to the release record.
