# The Nordic Challenge — Training app

A coach dashboard and athlete training app backed by Supabase (Postgres +
Auth + Storage). Coaches build training programs for their athletes, athletes
log sets/reps against those programs, and both sides message each other —
all persisted to a real database instead of in-memory mock state.

## One-time Supabase setup

1. **Run the schema.** In your Supabase project, open **SQL Editor → New
   query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and run it. This creates every table, Row Level Security policy, and the
   three storage buckets (`avatars`, `progress-photos`, `message-attachments`)
   the app needs. It's idempotent, so re-running it is safe.
2. **Confirm email settings.** By default Supabase requires email
   confirmation before a session is issued. That's fine — the app handles it
   (see "Email confirmation" below) — but if you'd rather skip it for local
   testing, turn it off under **Authentication → Providers → Email → Confirm
   email**.

## Local setup

```bash
cp .env.example .env   # then fill in your project's URL + anon/publishable key
npm install
npm run dev
```

Your Supabase URL and anon/publishable key are on the project's **Settings →
API** page. The anon key is safe to expose in a frontend bundle — it's
enforced entirely by the RLS policies in `schema.sql`.

## How accounts work

- Signing up asks whether you're a **coach** or an **athlete**.
- The first coach account created becomes *the* coach — every athlete who
  signs up afterward is automatically linked to that coach (`coach_id` on
  their profile). This app is built for a single coach with many athletes,
  matching the original prototype; supporting multiple independent coaches
  would mean adding an invite/select-your-coach step at signup.
- A coach with no athletes yet will see an empty client list until athletes
  sign up.
- A brand-new athlete has no program until their coach creates one in the
  **Program** tab of the coach dashboard.

### Email confirmation

If email confirmation is left on (Supabase's default), signing up won't
return a session immediately. The app stores the chosen name/role locally
and finishes creating the `profiles` row the moment you sign in after
confirming — no separate "finish setup" step needed.

## Project structure

```
src/
  lib/               Supabase client, date/stat helpers, data-access functions (lib/api/*)
  context/           AuthContext — session, profile, sign in/up/out
  pages/AuthPage.jsx Sign in / create account
  coach/             Coach dashboard (client list, program editor, messages, challenge)
  client/            Athlete-facing app (home, workout logging, tips, coach chat)
supabase/schema.sql  Full DDL + RLS policies + storage buckets
```

## Notes on what changed from the original prototypes

The two files supplied as references (`CoachDashboard.jsx`, `PTApp.jsx`) held
all state in `useState` with hard-coded seed data. This app keeps their UI
and interactions but reads/writes everything through Supabase instead:

- Programs, exercises, set-by-set logs, messages, and progress photos are all
  real rows, scoped per-user by Row Level Security.
- Streaks, weekly volume, PR detection, and XP are computed from actual
  logged workout history instead of hard-coded numbers.
- The prototype's client-app "trainer bar" (a dropdown to preview any client
  and a coach-mode program editor) doesn't make sense once there's real
  per-account auth — each login only ever sees its own data, and program
  editing lives exclusively in the coach dashboard.
