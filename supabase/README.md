# Supabase (remote-only)

This project uses hosted Supabase only; Docker and the local Supabase stack are not required. `config.toml`, `migrations/`, and `tests/` remain committed so the remote database schema and policies are reproducible.

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

Do not place either key in a `VITE_*` variable. The browser does not use the Supabase service role.
