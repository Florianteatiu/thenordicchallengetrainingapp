import { todayISO } from "./dates";

export const XP_PER_WORKOUT = 100;

// Levels follow Florian's own path: ballet, rugby, then crossing Sweden by
// swimming, cycling and running.
export const LEVELS = [
  { min: 0, name: "Rookie" },
  { min: 300, name: "Barre Work" },
  { min: 800, name: "Scrum Ready" },
  { min: 1500, name: "Open Water" },
  { min: 2500, name: "Long Haul" },
  { min: 4000, name: "Nordic Crosser" },
  { min: 6000, name: "Legend of the North" },
];

export function levelFor(xp) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.min) idx = i;
  });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return { number: idx + 1, name: current.name, next, progress, xp };
}

export function totalXp(sessions) {
  return sessions.filter((s) => s.completed_at).length * XP_PER_WORKOUT;
}

// Forgiving streak: counts scheduled workouts completed in a row. Rest days
// never break it, and today's workout only counts once it's done (it can't
// break the streak before the day is over).
export function workoutStreak(days, sessionsByDayId, today = todayISO()) {
  const past = days.filter((d) => d.date && d.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const d of past) {
    const done = Boolean(sessionsByDayId[d.id]?.completed_at);
    if (done) streak += 1;
    else if (d.date === today) continue;
    else break;
  }
  return streak;
}

export function sessionsByDay(sessions) {
  const map = {};
  for (const s of sessions) if (s.program_day_id) map[s.program_day_id] = s;
  return map;
}

export function dayStatus(day, sessionsByDayId, today = todayISO()) {
  const s = sessionsByDayId[day.id];
  if (s?.completed_at) return "done";
  if (s) return day.date && day.date < today ? "partial" : "started";
  if (!day.date) return "planned";
  if (day.date < today) return "missed";
  if (day.date === today) return "today";
  return "planned";
}
