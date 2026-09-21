import { startOfWeek, toDateStr, dateStrOf, todayStr } from "./dateUtils";

// moodCheckins: [{ logged_at, ... }]. A day counts as "trained" if it has at
// least one check-in — that's the only per-day completion signal this schema
// has (there's no workout_sessions table).

export function computeStreak(moodCheckins) {
  const trainedDates = new Set(moodCheckins.map((m) => dateStrOf(m.logged_at)));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (!trainedDates.has(toDateStr(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (trainedDates.has(toDateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function computeWeeklyDone(moodCheckins) {
  const start = startOfWeek(new Date());
  const trainedDates = new Set();
  moodCheckins.forEach((m) => {
    if (new Date(m.logged_at) >= start) trainedDates.add(dateStrOf(m.logged_at));
  });
  return trainedDates.size;
}

// loggedSets: [{ exercise_id, weight_kg, reps, logged_at }]

export function computeWeekVolume(loggedSets) {
  const start = startOfWeek(new Date());
  let vol = 0;
  loggedSets.forEach((s) => {
    if (new Date(s.logged_at) < start) return;
    vol += (Number(s.weight_kg) || 0) * (Number(s.reps) || 0);
  });
  return Math.round(vol);
}

export function computeWeekPRCount(loggedSets) {
  const start = startOfWeek(new Date());
  const priorBest = new Map();
  const thisWeekSets = [];
  loggedSets.forEach((s) => {
    const w = Number(s.weight_kg) || 0;
    if (new Date(s.logged_at) >= start) {
      thisWeekSets.push({ exerciseId: s.exercise_id, weight: w });
    } else {
      priorBest.set(s.exercise_id, Math.max(priorBest.get(s.exercise_id) || 0, w));
    }
  });
  const prExercises = new Set();
  thisWeekSets.forEach(({ exerciseId, weight }) => {
    const best = priorBest.get(exerciseId) || 0;
    if (best > 0 && weight > best) prExercises.add(exerciseId);
  });
  return prExercises.size;
}

// Best previously-logged weight per exercise, excluding today, used to flag
// a live "New PR" badge while logging today's sets.
export function computePreviousBestByExercise(loggedSets) {
  const today = todayStr();
  const best = new Map();
  loggedSets.forEach((s) => {
    if (dateStrOf(s.logged_at) === today) return;
    const w = Number(s.weight_kg) || 0;
    best.set(s.exercise_id, Math.max(best.get(s.exercise_id) || 0, w));
  });
  return best;
}

export function computeTodayProgress(exercises, todayLoggedSets) {
  const totalSets = exercises.reduce((sum, ex) => sum + ex.target_sets, 0);
  return { totalSets, doneSets: todayLoggedSets.length };
}

export function computeTodayVolume(todayLoggedSets) {
  return Math.round(todayLoggedSets.reduce((sum, s) => sum + (Number(s.weight_kg) || 0) * (Number(s.reps) || 0), 0));
}

// A day's "intensity" (0-3) for the calendar heatmap: a mood check-in means
// the workout was completed (3); otherwise it scales with how many sets got
// logged that day.
export function buildHeatmapCells(loggedSets, moodCheckins, days = 28) {
  const trainedDates = new Set(moodCheckins.map((m) => dateStrOf(m.logged_at)));
  const setCountByDate = new Map();
  loggedSets.forEach((s) => {
    const date = dateStrOf(s.logged_at);
    setCountByDate.set(date, (setCountByDate.get(date) || 0) + 1);
  });

  function intensityFor(date) {
    if (trainedDates.has(date)) return 3;
    const count = setCountByDate.get(date) || 0;
    if (count >= 4) return 2;
    if (count >= 1) return 1;
    return 0;
  }

  const cells = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = toDateStr(d);
    cells.push({ date: key, intensity: intensityFor(key) });
    d.setDate(d.getDate() + 1);
  }
  return cells;
}
