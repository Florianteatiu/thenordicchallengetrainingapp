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

## Roadmap
- Phase 1 (done): auth, exercise library, workout + program templates,
  calendar programs, logging for all formats, Today screen with companion, XP/streak.
- Phase 2: coach↔client chat (text, voice notes, comments on sets), needs-attention
  dashboard improvements, push notifications.
- Phase 3: weekly check-in forms, habits, body metrics, workout summary sharing.
- Phase 4: Cross Sweden map journey, companion mood photos, streak freezes, challenges.
