# The Nordic Challenge — Training app

A coach dashboard and athlete training app backed by your existing Supabase
project — `coaches`, `clients`, `programs`, `exercises`, `logged_sets`,
`messages`, `mood_checkins`, `progress_photos` — with Row Level Security
already in place. This app reads and writes those tables directly; it does
not define its own schema.

## One-time Supabase setup

Your project already has its schema and RLS policies. Two things were still
missing for the app to actually work, added by [`supabase/schema.sql`](supabase/schema.sql):

1. **A policy letting an athlete create their own `clients` row at signup.**
   There was no `INSERT` policy on `clients` or `coaches` at all, so no
   account of either kind could ever be created from the app.
2. **The three storage buckets** the app needs (`avatars`, `progress-photos`,
   `message-attachments`), with policies scoped to `coaches`/`clients`.

Run it once: Supabase project → **SQL Editor → New query** → paste the whole
file → **Run**. It's idempotent, safe to re-run.

### Coach setup (one-time, manual)

There's deliberately no self-signup path for the coach account — only one
coach should exist, and letting anyone claim it isn't something to automate.
Set it up once:

1. Supabase Dashboard → **Authentication → Users → Add user** — enter the
   coach's email and a password. (Don't use the app's own "Create account"
   form for this — that always creates an *athlete* row.)
2. Copy that new user's UID from the Users list.
3. Run in the SQL Editor:
   ```sql
   insert into public.coaches (id, name, email)
   values ('<uid-from-step-2>', 'Florian Teatiu', 'florian@example.com');
   ```
4. Add `VITE_COACH_ID=<uid-from-step-2>` to your `.env` — every athlete who
   signs up afterward gets auto-linked to this coach.
5. Sign in (not sign up) with that email/password in the app — it lands in
   the coach dashboard.

## Local setup

```bash
cp .env.example .env   # fill in Supabase URL/key + VITE_COACH_ID (step 4 above)
npm install
npm run dev
```

Your Supabase URL and anon/publishable key are on the project's **Settings →
API** page.

## How accounts work

- **Athletes self-signup** through the app's "Create account" form. Their
  `clients` row (`id` = their auth UID) is created immediately, linked to
  `VITE_COACH_ID`.
- **The coach account is provisioned manually**, once (see above).
- If email confirmation is on (Supabase's default), the athlete's `clients`
  row is created on their first real sign-in instead of at signup time — the
  app stores their name locally and finishes the job automatically.
- A brand-new athlete has no program until their coach creates one in the
  **Program** tab of the coach dashboard.

## Project structure

```
src/
  lib/               Supabase client, date/stat helpers, data-access functions (lib/api/*)
  context/           AuthContext — session, profile (coach or client row), sign in/up/out
  pages/AuthPage.jsx Sign in / create account
  coach/             Coach dashboard (client list, program editor, messages, challenge)
  client/            Athlete-facing app (home, workout logging, tips, coach chat)
supabase/schema.sql  Additive policies + storage buckets on top of your existing schema
```

## How the data model works

There's no `workout_sessions` table — logging a set is a direct insert into
`logged_sets` the moment you check it off (no pre-seeded placeholder rows).
"Finishing a workout" isn't a stored flag either: submitting a mood
check-in (`mood_checkins`) is what marks a day as complete, and doubles as
the signal the app uses to compute streaks and award XP. `clients.streak`
and `clients.xp` are updated at that same moment; everything else (weekly
volume, PR detection, the activity heatmap) is computed live from
`logged_sets` and `mood_checkins` history.

## Known simplifications vs. the original prototype

A few prototype features have no column to persist to in the existing
schema, and adding one wasn't part of what was agreed for this pass. They
still work, just as session-only state that resets on reload — flagging
these so you can decide whether they're worth a small schema addition later:

- **Swapping an exercise for an alternative.** `exercises` has no
  `swapped_to` column, and athletes only have read access to `exercises`
  (editing is coach-only) — so even with a column, athletes couldn't write
  to it under the current policies.
- **Per-exercise notes to the coach.** Neither `exercises` nor `logged_sets`
  has a notes field.
- **"I'm in" on the monthly challenge.** `clients` has no column for it.

If you want any of these to persist, it's a small addition (one column +
one policy each) — just ask.
