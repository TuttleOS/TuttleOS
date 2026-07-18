# Tuttle OS web app (Phase 1+)

Next.js App Router + TypeScript + Tailwind + Supabase.

## Run locally

```bash
cd web
cp ../.env.local .env.local   # if needed
npm install
npm run dev
```

Open http://localhost:3000 → redirects to `/login`.

## Before first staff login

1. Supabase Auth → create a user (email/password); enable MFA for production.
2. Link to staff:

```sql
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- Example: attach Auth UUID to a staff row
UPDATE core.staff
SET auth_user_id = '<auth-user-uuid>'
WHERE email = 'you@firm.com';
```

Or insert a new `core.person` + `core.staff` with `auth_user_id` set.

3. Dashboard → Settings → API → Exposed schemas must include `core` (and the other domain schemas).

## What's in Phase 1 shell

- Parchment / Midnight tokens
- Security headers
- Auth middleware + login
- Role home routing
- App shell + global search
- Workspace placeholders: `/intake` `/cases` `/litigation` `/owner` `/demands` `/liens` `/review`
- `/api/health` (no PHI)
