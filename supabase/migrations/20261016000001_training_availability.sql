-- When a client can train, asked in the welcome flow and editable on the Me
-- page: how many days a week, which days suit them (1 = Mon … 7 = Sun) and
-- how long each session can be (30, 45, 60 or 75 minutes).
alter table public.profiles
  add column if not exists training_days_per_week smallint check (training_days_per_week between 1 and 7),
  add column if not exists training_days smallint[] check (training_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  add column if not exists session_minutes smallint check (session_minutes in (30, 45, 60, 75));

grant update (training_days_per_week, training_days, session_minutes) on public.profiles to authenticated;
