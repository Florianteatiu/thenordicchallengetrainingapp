-- Equipment picked from a list instead of written in the exercise name, and
-- a flag for one-sided exercises (reps/time are per side; the timer runs
-- left, then right). Two exercises may now share a name if their equipment
-- differs (Chest press · Dumbbell vs Chest press · Barbell), so their weights
-- and history stay apart.

alter table public.exercises add column if not exists equipment text;
alter table public.exercises add column if not exists unilateral boolean not null default false;

drop index if exists public.exercises_name_unique;
create unique index if not exists exercises_name_equipment_unique on public.exercises (lower(name), coalesce(equipment, ''));

-- Starting values for the existing library, from the names. Only fills blanks.
update public.exercises set equipment = case
  when name ~* 'smith machine' then 'Smith machine'
  when name ~* 'landmine' then 'Landmine'
  when name ~* '^cable|cable |chin cable|pallof|high elbow cable|bend over straight arm' then 'Cable'
  when name ~* 'physio ball' then 'Physio ball'
  when name ~* 'slam ball' then 'Slam ball'
  when name ~* 'wall ball|med ball' then 'Medicine ball'
  when name ~* 'sled' then 'Sled'
  when name ~* 'rowing machine' then 'Rower'
  when name ~* 'ski erg' then 'Ski erg'
  when name ~* 'assault bike|cycling' then 'Bike'
  when name ~* 'kettlebell|goblet' then 'Kettlebell'
  when name ~* 'dumbbell|single-arm|\mDB\M|skull crashers|front raises|bicep curl|incline bench back flies|straight arm kickback' then 'Dumbbell'
  when name ~* 'machine|lat pulldown|ghd' then 'Machine'
  when name ~* 'plate' then 'Plate'
  when name ~* '\mband\M' then 'Band'
  when name ~* '^(back squat|front squat|deadlift|romanian deadlift|bench press|bent-over row|barbell wide row|hip thrust|overhead squat|clean|clean & press|split stance deadlift|thruster|dead row|wide dead row|upright row)$' then 'Barbell'
  when name ~* 'push-up|pull-up|plank|burpee|box jump|jump squat|dead bug|sit ups|mountain climber|lateral shuffle|hanging knee|copenhagen|step ups|leg scissors|walkout' then 'Bodyweight'
  when name ~* '^(run|interval run|brisk walk)$' then 'Treadmill'
  else null
end
where equipment is null;

update public.exercises set unilateral = true
where not unilateral and (
  name ~* 'single|unilateral|bulgarian|split squat|skater|pallof|copenhagen|step ups|half kneel|pistol|elevated back foot|cable leg raise|balance leg raise|single kneel|kickback'
  or lower(name) in ('side plank', 'overhead reverse lunge', 'reverse lunge to bench toe tap', 'lunge to box foot tap + overhead press', 'smith machine lunge to high knee', 'smith machine reverse lunge + high knee calf raise', 'landmine seated press', 'cable lateral resistance punch', 'lateral cable double punch')
);
