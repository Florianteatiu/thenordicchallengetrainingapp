import { startOfWeek, toDateStr } from "./dateUtils";

export function buildHeatmapCells(sessions, days = 28) {
  const byDate = new Map();
  sessions.forEach((s) => {
    const { totalSets, doneSets } = computeTodayProgress({ all: s.set_logs || [] });
    byDate.set(s.session_date, totalSets > 0 ? Math.min(3, Math.round((doneSets / totalSets) * 3)) : 0);
  });
  const cells = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = toDateStr(d);
    cells.push({ date: key, intensity: byDate.get(key) || 0 });
    d.setDate(d.getDate() + 1);
  }
  return cells;
}

// sessions: array of workout_sessions rows, each with a nested set_logs array
// (as returned by fetchRecentSessions).

export function computeStreak(sessions) {
  const completedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.session_date));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (!completedDates.has(toDateStr(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (completedDates.has(toDateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function computeWeeklyDone(sessions) {
  const start = startOfWeek(new Date());
  return sessions.filter((s) => s.completed && new Date(`${s.session_date}T00:00:00`) >= start).length;
}

export function computeWeekVolume(sessions) {
  const start = startOfWeek(new Date());
  let vol = 0;
  sessions.forEach((s) => {
    if (new Date(`${s.session_date}T00:00:00`) < start) return;
    (s.set_logs || []).forEach((sl) => {
      if (sl.done) vol += (Number(sl.weight) || 0) * (Number(sl.reps) || 0);
    });
  });
  return Math.round(vol);
}

export function computeWeekPRCount(sessions) {
  const start = startOfWeek(new Date());
  const priorBest = new Map();
  const thisWeekSets = [];
  sessions.forEach((s) => {
    const isThisWeek = new Date(`${s.session_date}T00:00:00`) >= start;
    (s.set_logs || []).forEach((sl) => {
      if (!sl.done) return;
      const w = Number(sl.weight) || 0;
      if (isThisWeek) {
        thisWeekSets.push({ exerciseId: sl.exercise_id, weight: w });
      } else {
        priorBest.set(sl.exercise_id, Math.max(priorBest.get(sl.exercise_id) || 0, w));
      }
    });
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
export function computePreviousBestByExercise(sessions) {
  const today = toDateStr(new Date());
  const best = new Map();
  sessions.forEach((s) => {
    if (s.session_date === today) return;
    (s.set_logs || []).forEach((sl) => {
      if (!sl.done) return;
      const w = Number(sl.weight) || 0;
      best.set(sl.exercise_id, Math.max(best.get(sl.exercise_id) || 0, w));
    });
  });
  return best;
}

export function computeTodayProgress(setLogsByExercise) {
  let totalSets = 0;
  let doneSets = 0;
  Object.values(setLogsByExercise).forEach((sets) => {
    totalSets += sets.length;
    doneSets += sets.filter((s) => s.done).length;
  });
  return { totalSets, doneSets };
}

export function computeTodayVolume(setLogsByExercise) {
  let vol = 0;
  Object.values(setLogsByExercise).forEach((sets) => {
    sets.forEach((s) => {
      if (s.done) vol += (Number(s.weight) || 0) * (Number(s.reps) || 0);
    });
  });
  return Math.round(vol);
}
