# Project notes for Claude

Florian (coach, brand: The Nordic Challenge) builds this app entirely through
chat with Claude and does not want to touch other platforms. Do the work
end to end; explain in plain, non-technical language.

## Layout
- `app/` — the live app (Vite + React Router). Entry: `index.html` → `app/main.jsx`.
  - `lib/api.js` all Supabase calls; `lib/gamify.js` XP/levels/streak;
    `lib/companion.js` Florian's companion lines (his voice: direct, warm, never guilt-tripping).
  - `coach/` coach pages, `client/` client pages, `components/` shared.
- `supabase/migrations/` — schema + RLS + RPCs (`copy_workout`, `copy_program`,
  `copy_week`, `add_workout_to_day`, `activate_program`). Never edit an applied
  migration; add a new file.
- `src/`, `supabase/schema.sql` — old prototype, unused (kept until Florian OKs deleting).

## Data model
exercises (library) → workouts → workout_blocks (format: sets|circuit|intervals|amrap|emom)
→ block_exercises. programs (weeks, is_template, client_id, start_date, status
draft|active|completed) → program_days (week, day 1=Mon, workout_id; each day owns a
private workout copy). Logging: workout_sessions (per client + program_day),
set_logs, block_logs. Week 1 starts on the Monday of start_date.

## Brand
Black background, yellow `#FFE234`, Barlow Condensed (display) + Inter.
Companion = Florian's face (`COMPANION_PHOTOS` in `app/config.js`, files in
`public/companion/`), falls back to his profile photo, then the logo.
Levels follow his story: Rookie → Barre Work → Scrum Ready → Open Water →
Long Haul → Nordic Crosser → Legend of the North.

## Testing
Run a local Supabase (`npx supabase start` in a scratch dir with the
migrations copied in; Docker daemon may need `dockerd &`), put its URL/anon key
in `.env.local` as `VITE_DEV_SUPABASE_URL` / `VITE_DEV_SUPABASE_ANON_KEY`,
`npm run dev`, and drive it with Playwright
(`executablePath: '/opt/pw-browsers/chromium'`). `npm run build` + `npx oxlint app` before pushing.

## Phase 2 features (where things live)
- Chat: `messages` table (one conversation per client_id; optional set_log_id/session_id
  + context_label = comment on a set/workout), voice notes in private `voice-notes`
  bucket. `components/Chat.jsx` (shared), `client/ChatPage.jsx`, `coach/InboxPage.jsx`.
- Weekly check-in: `checkins` (one per client per week_start; trigger `guard_checkin`
  keeps client answers and coach_reply separate), photos in private `checkin-photos`.
  `client/CheckinPage.jsx`, `components/Checkins.jsx`. Prompted Fri–Mon.
- Cross Sweden: `activities` + `journey_totals()` (activities + workout distance on
  exercises with `journey_kind`). Routes/places/stories in `lib/journey.js`
  (run Stockholm→Gothenburg 513 km, bike Malmö→Stockholm 695 km, swim Gothenburg→Malmö
  240 km). Florian's stories go in each place's `story` field. Map outline in
  `lib/swedenMap.js` (generated from Natural Earth, don't hand-edit).
- Push: `push_subscriptions`, edge function `supabase/functions/notify` (types: message,
  workout, checkin, checkin_reply, program, daily). Needs VAPID_PUBLIC_KEY/PRIVATE_KEY
  function secrets + `VAPID_PUBLIC_KEY` in `app/config.js`. Daily reminder = pg_cron job
  calling notify with {type:"daily"} (deduped by `reminder_log`).
- Share card: `lib/shareCard.js` (canvas, 1080×1920). Welcome flow: `client/WelcomeFlow.jsx`
  (until `profiles.onboarded_at` is set; video = `WELCOME_VIDEO_URL` in config).
- Needs attention list: `coach/ClientsPage.jsx`. Lift charts: `components/LiftProgress.jsx`.
- Exercise videos: upload to public `exercise-videos` bucket or paste a YouTube/Vimeo link;
  played in-app by `components/VideoEmbed.jsx`.

## Roadmap
- Phase 1 (done): auth, exercise library, workout + program templates,
  calendar programs, logging for all formats, Today screen with companion, XP/streak.
- Phase 2 (done): chat + voice notes + set comments, push notifications, weekly
  check-ins, share card, Cross Sweden map, welcome flow, needs-attention, lift charts.
- Waiting on Florian: exercise demo videos, welcome video, journey stories per place.
- Later: habits, body metrics charts, companion mood photos, streak freezes, challenges.
