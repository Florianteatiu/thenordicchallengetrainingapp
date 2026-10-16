-- When a client can train, asked in the welcome flow and editable on the Me
-- page: how many days a week, and which days suit them (1 = Mon … 7 = Sun).
alter table public.profiles
  add column if not exists training_days_per_week smallint check (training_days_per_week between 1 and 7),
  add column if not exists training_days smallint[] check (training_days <@ array[1,2,3,4,5,6,7]::smallint[]);

grant update (training_days_per_week, training_days) on public.profiles to authenticated;
