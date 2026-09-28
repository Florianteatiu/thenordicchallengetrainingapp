# The Nordic Challenge — Training app

Florian's coaching app. Clients get their program, log their workouts and get
cheered on by Florian's face; Florian builds programs from reusable templates
and sees who trained, who missed, and how it felt.

- **Coach side** (desktop-first, works on phone): clients overview, client
  profile + history, multi-week program builder (drag and drop, copy weeks),
  workout builder (straight sets, circuits, intervals/HIIT, AMRAP, EMOM),
  workout and program templates, exercise library with demo videos and cues.
- **Client side** (phone-first, installable): Today screen with the companion,
  week strip, streak/XP/levels; full plan; workout player with set logging,
  last-time numbers, PR detection, rest timer, full-screen interval timer,
  finish check-in (feeling, RPE, note) and celebration; progress history.

## Stack

Vite + React (in `app/`), Supabase (auth, Postgres with row level security,
storage), hosted on Vercel. Database changes live in `supabase/migrations/`.

The old prototype is still in `src/` and `supabase/schema.sql` but is no
longer used — `index.html` loads `app/main.jsx`.

## Accounts

- The **first account ever created becomes the coach** (enforced in the
  database). Every account after that is a client.
- Clients sign up from the app link (Clients page → "Copy invite link").
- A client only sees a program once the coach makes it **active**.

## Connecting to Supabase

`app/config.js` holds the project URL and the public anon key (safe to ship;
every table is protected by row level security). Apply the migrations in
`supabase/migrations/` in order.

## Local development

```bash
npm install
npx supabase start          # local Supabase in Docker (needs supabase/config.toml)
# .env.local:
#   VITE_DEV_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_DEV_SUPABASE_ANON_KEY=<anon key printed by supabase start>
npm run dev
```

`VITE_DEV_*` values are only read in dev builds; production always uses
`app/config.js`.

## Notifications, chat & the rest of phase 2

- Migration `supabase/migrations/20260929000001_phase2_coaching.sql` adds chat,
  check-ins, the Cross Sweden journey and push subscriptions.
- Edge function `notify` (`supabase/functions/notify`) sends push notifications.
  Deploy: `npx supabase functions deploy notify --project-ref <ref> --use-api`.
  It needs the `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` function secrets
  (generate a pair with `npx web-push generate-vapid-keys`), and the public key
  in `app/config.js` (`VAPID_PUBLIC_KEY`). Until then notifications are simply
  hidden in the app.
- Training-day reminder: a pg_cron job (`daily-training-reminder`, 06:00 UTC)
  posts `{"type":"daily"}` to the function with the public anon key; the
  `reminder_log` table makes sure each client gets at most one per day.
- Florian's content: exercise videos (Library → edit exercise → Upload video),
  the welcome video (`WELCOME_VIDEO_URL` in `app/config.js`) and a story per
  place on the map (`story` fields in `app/lib/journey.js`).
