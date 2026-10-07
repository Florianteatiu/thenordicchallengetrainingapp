-- Equipment moves out of exercise names into the equipment field
-- ("Smith machine chest press" -> "Chest press" · Smith machine). Workouts
-- point at exercises by id, so every past and planned workout shows the new
-- name. Exercises whose movement is the equipment (Landmine…, Sled push,
-- Kettlebell swing, Rowing machine, Slam ball) keep their names.

update public.exercises e
set name = v.new_name, equipment = v.equipment
from (values
  ('Smith machine chest press', 'Chest press', 'Smith machine'),
  ('Smith machine incline chest press', 'Incline chest press', 'Smith machine'),
  ('Smith machine narrow chest press', 'Narrow chest press', 'Smith machine'),
  ('Smith machine lunge to high knee', 'Lunge to high knee', 'Smith machine'),
  ('Smith machine reverse lunge + high knee calf raise', 'Reverse lunge + high knee calf raise', 'Smith machine'),
  ('Smith machine row', 'Bent-over row', 'Smith machine'),
  ('Smith machine seated shoulder press', 'Seated shoulder press', 'Smith machine'),
  ('Smith machine single leg squat', 'Single-leg squat', 'Smith machine'),
  ('Smith machine sumo squat', 'Sumo squat', 'Smith machine'),
  ('Cable chest flies', 'Chest flies', 'Cable'),
  ('Cable chest press', 'Chest press', 'Cable'),
  ('Cable high row', 'High row', 'Cable'),
  ('Cable lateral resistance punch', 'Lateral resistance punch', 'Cable'),
  ('Cable leg raise', 'Leg raise', 'Cable'),
  ('Cable plank row', 'Plank row', 'Cable'),
  ('Cable row', 'Seated row', 'Cable'),
  ('Cable tricep extension', 'Tricep extension', 'Cable'),
  ('Cable trunk rotation (backward pull)', 'Trunk rotation (backward pull)', 'Cable'),
  ('Chin cable row', 'Chin row', 'Cable'),
  ('High elbow cable pull', 'High elbow pull', 'Cable'),
  ('Lateral cable double punch', 'Lateral double punch', 'Cable'),
  ('Single kneel diagonal cable row', 'Single kneel diagonal row', 'Cable'),
  ('Dumbbell bench press', 'Chest press', 'Dumbbell'),
  ('Dumbbell chest flies', 'Chest flies', 'Dumbbell'),
  ('Dumbbell clean & press', 'Clean & press', 'Dumbbell'),
  ('Incline dumbbell press', 'Incline chest press', 'Dumbbell'),
  ('Single-arm dumbbell row', 'Single-arm row', 'Dumbbell'),
  ('Lunge to single-arm DB overhead press', 'Lunge to single-arm overhead press', 'Dumbbell'),
  ('Back flies machine', 'Back flies', 'Machine'),
  ('Shoulder press machine', 'Shoulder press', 'Machine'),
  ('Seated row machine', 'Seated row', 'Machine'),
  ('Incline chest press machine', 'Incline chest press', 'Machine'),
  ('Barbell wide row', 'Wide row', 'Barbell'),
  ('Physio ball hamstring curl', 'Hamstring curl', 'Physio ball')
) as v(old_name, new_name, equipment)
where lower(e.name) = lower(v.old_name)
  and not exists (
    select 1 from public.exercises x
    where lower(x.name) = lower(v.new_name) and coalesce(x.equipment, '') = v.equipment and x.id <> e.id
  );

-- A dumbbell version of Shoulder press, for sets that were done with dumbbells.
insert into public.exercises (name, category, tracking, body_region, equipment, unilateral, cues, video_url)
select name, category, tracking, body_region, 'Dumbbell', unilateral, cues, video_url
from public.exercises
where lower(name) = 'shoulder press' and equipment is null
  and not exists (select 1 from public.exercises where lower(name) = 'shoulder press' and equipment = 'Dumbbell');

-- Past "Chest press" / "Shoulder press" sets noted as dumbbell ("2 × 8 kg DB")
-- move to the Dumbbell version, so their weights stop mixing with bar/machine.
do $$
declare
  pair record;
begin
  for pair in
    select g.id as generic_id, d.id as db_id
    from public.exercises g
    join public.exercises d on lower(d.name) = lower(g.name) and d.equipment = 'Dumbbell'
    where lower(g.name) in ('chest press', 'shoulder press') and g.equipment is null
  loop
    update public.pt_set_logs l set exercise_id = pair.db_id
    from public.block_exercises be
    where l.block_exercise_id = be.id and be.exercise_id = pair.generic_id and be.load ~* '\mDB\M';
    update public.set_logs l set exercise_id = pair.db_id
    from public.block_exercises be
    where l.block_exercise_id = be.id and be.exercise_id = pair.generic_id and be.load ~* '\mDB\M';
    update public.block_exercises set exercise_id = pair.db_id
    where exercise_id = pair.generic_id and load ~* '\mDB\M';
  end loop;
end $$;
