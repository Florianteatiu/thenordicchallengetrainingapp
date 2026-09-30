import { todayISO } from "./dates";

export const XP_PER_WORKOUT = 100;

// What clients see instead of "XP": Mana, the Polynesian idea of power and
// strength you build up. (Code still says "xp" internally.)
export const POINTS = "Mana";

// Levels follow Florian's own path: growing up in Tahiti, ballet, rugby,
// then crossing Sweden by swimming, cycling and running.
export const LEVELS = [
  { min: 0, name: "Tamari'i", meaning: "Everyone starts as \u201cthe little one\u201d. Welcome to the family." },
  { min: 300, name: "Barre", meaning: "Ballet: discipline, control and showing up every day." },
  { min: 800, name: "Scrum", meaning: "Rugby: grit, teamwork and getting back up." },
  { min: 1500, name: "Va'a", meaning: "Paddling the lagoon in Tahiti: rhythm and endurance." },
  { min: 2500, name: "Open Water", meaning: "The swim leg: calm and steady, stroke after stroke." },
  { min: 4000, name: "Long Haul", meaning: "Bike and run across the country: patience and staying power." },
  { min: 6000, name: "Nordic Crosser", meaning: "You've gone the distance, all the way across Sweden." },
  { min: 9000, name: "Aito", meaning: "Champion. Warrior. The strongest version of you." },
];

export function levelFor(xp) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.min) idx = i;
  });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return { number: idx + 1, name: current.name, meaning: current.meaning, next, progress, xp };
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
