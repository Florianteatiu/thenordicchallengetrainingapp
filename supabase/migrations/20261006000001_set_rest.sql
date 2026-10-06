-- Rest per logged set, so cardio can be logged as work + rest
-- (e.g. Tabata: 8 × 0:20 work / 0:10 rest), next to distance.
alter table public.set_logs add column if not exists rest_sec int check (rest_sec >= 0);
alter table public.pt_set_logs add column if not exists rest_sec int check (rest_sec >= 0);
