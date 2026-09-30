-- Supersets, "weight + time" logging, and upper/lower/full-body tags for
-- strength exercises.

-- Superset: exercises done back to back, logged set by set; rest after the round.
alter table public.workout_blocks drop constraint if exists workout_blocks_format_check;
alter table public.workout_blocks add constraint workout_blocks_format_check
  check (format in ('sets', 'superset', 'circuit', 'intervals', 'amrap', 'emom'));

-- Weight + time: e.g. a 40 s farmer carry at 24 kg, or a weighted plank.
alter table public.exercises drop constraint if exists exercises_tracking_check;
alter table public.exercises add constraint exercises_tracking_check
  check (tracking in ('weight_reps', 'weight_time', 'reps', 'time', 'distance_time'));

-- Where a strength exercise works: makes the library easier to filter.
alter table public.exercises add column if not exists body_region text
  check (body_region in ('upper', 'lower', 'full'));

update public.exercises set body_region = 'lower'
where category = 'strength' and body_region is null and lower(name) in (
  'back squat', 'front squat', 'goblet squat', 'squat - light', 'bulgarian split squat', 'walking lunge',
  'deadlift', 'romanian deadlift', 'unilateral rdl - elevated back leg', 'hip thrust', 'calf raises',
  'copenhagen plank'
);

update public.exercises set body_region = 'upper'
where category = 'strength' and body_region is null and lower(name) in (
  'bench press', 'dumbbell bench press', 'push-up', 'overhead press', 'shoulder press', 'shoulder push up',
  'front raises', 'skull crashers', 'pull-up', 'lat pulldown', 'bent-over row', 'barbell wide row',
  'single-arm dumbbell row', 'bend over straight arm pull down', 'shoulder flossing'
);

update public.exercises set body_region = 'full'
where category = 'strength' and body_region is null and lower(name) in (
  'kettlebell swing', 'farmer carry', 'walkout to push up', 'wide dead row'
);
