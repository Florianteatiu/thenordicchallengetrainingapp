export const CATEGORIES = [
  { id: "strength", label: "Strength" },
  { id: "conditioning", label: "Conditioning" },
  { id: "endurance", label: "Endurance" },
  { id: "mobility", label: "Mobility" },
  { id: "core", label: "Core" },
];

export const TRACKING = [
  { id: "weight_reps", label: "Weight × reps" },
  { id: "reps", label: "Reps only" },
  { id: "time", label: "Time" },
  { id: "distance_time", label: "Distance + time" },
];

export const FORMATS = [
  { id: "sets", label: "Straight sets", hint: "Classic sets and reps, logged set by set" },
  { id: "circuit", label: "Circuit", hint: "Go through the list for a number of rounds" },
  { id: "intervals", label: "Intervals / HIIT", hint: "Work and rest on a timer, e.g. 40s on / 20s off" },
  { id: "amrap", label: "AMRAP", hint: "As many rounds as possible in a time cap" },
  { id: "emom", label: "EMOM", hint: "Every minute on the minute" },
];

export function formatLabel(id) {
  return FORMATS.find((f) => f.id === id)?.label ?? id;
}

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// 95 -> "1:35", 3600 -> "60:00"
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Human duration: 90 -> "90s", 120 -> "2 min", 150 -> "2:30 min"
export function formatDuration(sec) {
  if (sec == null || sec === "") return "";
  const s = Number(sec);
  if (s < 60 || (s < 120 && s % 60 !== 0)) return `${s}s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${formatClock(s)} min`;
}

export function formatDistance(m) {
  if (m == null || m === "") return "";
  const n = Number(m);
  return n >= 1000 ? `${+(n / 1000).toFixed(2)} km` : `${n} m`;
}

// Accepts "90", "1:30", "01:30" -> seconds. Empty -> null.
export function parseDuration(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const total = Number(m || 0) * 60 + Number(s || 0);
    return Number.isFinite(total) ? total : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// One-line prescription for an exercise inside a block, e.g. "3 × 8–10 · 60 kg · rest 90s"
export function prescription(item, format, tracking) {
  const parts = [];
  const volume = [];
  if (format === "sets" && item.sets) volume.push(`${item.sets} ×`);
  if (item.reps) volume.push(item.reps);
  if (item.duration_sec) volume.push(formatDuration(item.duration_sec));
  if (item.distance_m) volume.push(formatDistance(item.distance_m));
  if (volume.length) parts.push(volume.join(" "));
  if (item.load) parts.push(item.load);
  if (item.tempo) parts.push(`tempo ${item.tempo}`);
  if (format === "sets" && item.rest_sec) parts.push(`rest ${formatDuration(item.rest_sec)}`);
  if (!parts.length && tracking === "time") return "Timed";
  return parts.join(" · ");
}

// One-line description of a block's structure, e.g. "4 rounds · 40s on / 20s off"
export function blockSummary(block) {
  switch (block.format) {
    case "circuit":
      return [block.rounds && `${block.rounds} rounds`, block.rest_sec && `rest ${formatDuration(block.rest_sec)} between rounds`].filter(Boolean).join(" · ");
    case "intervals":
      return [block.rounds && `${block.rounds} rounds`, block.work_sec && `${formatDuration(block.work_sec)} on`, block.rest_sec != null && block.rest_sec !== "" && `${formatDuration(block.rest_sec)} off`].filter(Boolean).join(" · ");
    case "amrap":
      return block.time_cap_sec ? `AMRAP ${formatDuration(block.time_cap_sec)}` : "AMRAP";
    case "emom":
      return block.rounds ? `EMOM ${block.rounds} min` : "EMOM";
    default:
      return "";
  }
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function firstName(name = "") {
  return name.trim().split(/\s+/)[0] || "";
}
