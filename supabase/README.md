# Supabase authentication and database

Production uses hosted Supabase. The optional local stack is used for the pgTAP account-policy release test; `config.toml`, migrations, and tests remain committed so authentication settings and database policies are reproducible.

Never commit service-role keys, access tokens, or Supabase CLI state. Those paths are listed in the repository `.gitignore`.

One-time remote setup:

```bash
npm run supabase:login
supabase link --project-ref YOUR_PROJECT_REF
npm run supabase:migrations
```

After reviewing the output and confirming the target project, apply the committed migrations with:

```bash
npm run supabase:push
```

`supabase:push` changes the linked remote database. It must be run only after confirming the project reference and taking/confirming a backup.

Server-side deployment secrets belong in the hosting provider’s encrypted environment store:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

The browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never expose the service role, Turnstile secret, or cron secret through a `VITE_*` variable.

For local account-policy tests, set `SUPABASE_AUTH_TURNSTILE_SECRET`, start the local stack, and run:

```bash
supabase start
npm run test:accounts:db
```

In every hosted project, mirror `config.toml`: enable email confirmation and double-confirmed email changes, set one-hour email-link expiry, 12-character passwords, Turnstile, 30 sign-in/sign-up and token-verification requests per five minutes per IP, 15-minute JWTs, a 12-hour inactivity timeout, and a seven-day session time-box. Production requires Supabase Pro for server-side session limits.
