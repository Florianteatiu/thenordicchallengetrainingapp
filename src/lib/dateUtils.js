export function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export function todayStr() {
  return toDateStr(new Date());
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Start/end ISO instants for a given calendar date string ("YYYY-MM-DD"),
// used to filter timestamptz columns (logged_at, etc.) by local calendar day.
export function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function dateStrOf(isoString) {
  return toDateStr(new Date(isoString));
}

export function relativeTimeLabel(isoString) {
  if (!isoString) return "never";
  const then = new Date(isoString);
  const diffMs = Date.now() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function relativeDayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
