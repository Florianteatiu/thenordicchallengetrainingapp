// All dates in the app are local calendar dates as "YYYY-MM-DD" strings.

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// Monday of the week containing `iso`.
export function mondayOf(iso) {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function nextMonday(iso = todayISO()) {
  const monday = mondayOf(iso);
  return monday === iso ? iso : addDays(monday, 7);
}

// Program week 1 starts on the Monday of the start date's week; day 1 = Monday.
export function programDayDate(startDate, week, day) {
  if (!startDate) return null;
  return addDays(mondayOf(startDate), (week - 1) * 7 + (day - 1));
}

export function programWeekForDate(startDate, iso) {
  if (!startDate) return null;
  const diff = daysBetween(mondayOf(startDate), iso);
  return Math.floor(diff / 7) + 1;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / 86400000);
}

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

export function formatDate(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  if (!iso) return "";
  return parseISODate(iso).toLocaleDateString(undefined, opts);
}

export function formatDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function greetingForNow() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
