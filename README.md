# Proven Power Mobile

Customer-engagement app for Proven Power (John Deere dealer — Oconomowoc & Waukesha, WI): mobile (Expo) + customer web (Next.js) + a staff admin panel (Next.js), backed by Supabase (Postgres + Auth + Storage) and a thin Node/Express API for things RLS can't do (push/SMS dispatch, maintenance schedule generation, staff account creation).

This README covers one-time setup. Phase 1 MVP milestones: M0 (this — scaffolding + auth) → My Garage → Maintenance → Service Requests → Parts Requests → Messaging → Home/Push → Admin hardening.

## Apps

| App | Path | Who | Port |
|---|---|---|---|
| Mobile | `apps/mobile` | customers (iOS/Android, Expo) | — |
| Web | `apps/web` | customers (browser) | 3000 |
| Admin | `apps/admin` | dealership staff only | 3001 |
| API | `apps/api` | internal service, called by admin/clients for privileged actions | 4000 |

## One-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. Run the migrations in `supabase/migrations/` in order (via `supabase db push` with the Supabase CLI, or paste each file into the SQL editor in order):
   - `0001_init_identity_and_locations.sql` — profiles, business accounts, staff roles, dealership locations, RLS, and the Custom Access Token Hook function.
   - `0002_winter_storage_zones.sql` — Winter Storage zone framework (zone/zip/season-window scaffolding; no UI yet).
   - `0003_equipment.sql` — My Garage: equipment, photos, documents, hour readings, RLS, and the equipment-photos/equipment-documents storage buckets.
   - `0004_maintenance.sql` — maintenance schedule templates + auto-generated per-equipment maintenance tasks (trigger-based, no cron needed).
   - `0005_notification_rules.sql` — push tokens + admin-configurable automated alert rules (dealership-wide defaults, with per-account override support in the schema). Configurable at `apps/admin` → Notification Rules; actual push/SMS delivery is a later milestone.
3. Run `supabase/seed.sql` to load Proven Power's two real locations (Oconomowoc, Waukesha). Optionally also run `supabase/seed_maintenance_templates.sql` for sample factory maintenance schedules (placeholder data — replace with the dealership's real schedules).
4. **Enable the Custom Access Token Hook**: Supabase Dashboard → Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`. This stamps `account_type` onto every JWT so the admin app can gate staff-only access. Without this step, `apps/admin` will reject every login.
5. In Supabase **Authentication → Providers → Email**, turn **off** "Confirm email" for local dev so sign-up gets a session immediately.
6. Grab your Project URL, **Publishable key**, and **Secret key** (Supabase → Project Settings → API — note Supabase recently renamed `anon key` → `publishable key` and `service_role key` → `secret key`).
7. Copy each app's env example and fill in the values:
   - `apps/mobile/.env.example` → `apps/mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `apps/web/.env.local.example` → `apps/web/.env.local`
   - `apps/admin/.env.local.example` → `apps/admin/.env.local`
   - `apps/api/.env.example` → `apps/api/.env` (also needs `SUPABASE_SECRET_KEY` — the secret key, never exposed to a client)
8. Install dependencies from the repo root: `pnpm install`

## Day-to-day use

- `pnpm dev` — runs every app in parallel via Turborepo (mobile via Expo CLI, web on :3000, admin on :3001, api on :4000).
- There is **no public sign-up for staff accounts**. Create the first staff account by calling the API directly once it's running (you'll need a manager already in `staff_roles` to call this normally — for the very first manager, insert a row into `staff_roles` by hand in the Supabase SQL editor after that person signs up as a customer, then promote their `profiles.account_type` to `'staff'`):
  ```
  POST http://localhost:4000/staff
  Authorization: Bearer <a manager's access token>
  { "email": "...", "full_name": "...", "department": "manager" }
  ```

## Notes

- `apps/admin` is a separate Next.js app/deploy target from `apps/web` for a hard session/cookie boundary between staff and customers — see the implementation plan for reasoning.
- Winter Storage zone boundaries and season date windows are not yet populated — `0002_winter_storage_zones.sql` only creates the framework (`storage_zones`, `storage_zone_zip_codes`, `storage_season_windows`). Populate them once that data is finalized.
