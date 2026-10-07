export const CATEGORIES = [
  { id: "strength", label: "Strength" },
  { id: "conditioning", label: "Conditioning" },
  { id: "endurance", label: "Endurance" },
  { id: "mobility", label: "Mobility" },
  { id: "core", label: "Core" },
];

// Sub-categories for strength exercises.
export const BODY_REGIONS = [
  { id: "upper", label: "Upper body" },
  { id: "lower", label: "Lower body" },
  { id: "full", label: "Full body" },
];

export function regionLabel(id) {
  return BODY_REGIONS.find((r) => r.id === id)?.label ?? "";
}

export const TRACKING = [
  { id: "weight_reps", label: "Weight × reps" },
  { id: "weight_time", label: "Weight + time" },
  { id: "reps", label: "Reps only" },
  { id: "time", label: "Time" },
  { id: "distance_time", label: "Distance + time" },
];

export const FORMATS = [
  { id: "sets", label: "Straight sets", hint: "Classic sets and reps, logged set by set" },
  { id: "superset", label: "Superset", hint: "One set of each exercise back to back, then rest. That's one round. Sets = number of rounds." },
  { id: "circuit", label: "Circuit", hint: "Go through the list for a number of rounds" },
  { id: "intervals", label: "Intervals / HIIT", hint: "Work and rest on a timer, e.g. 40s on / 20s off" },
  { id: "amrap", label: "AMRAP", hint: "As many rounds as possible in a time cap" },
  { id: "emom", label: "EMOM", hint: "Every minute on the minute" },
];

// Straight sets and supersets are both logged set by set.
export const isSetBased = (format) => format === "sets" || format === "superset";

// Superset exercises are labelled A1, A2… and only the last one starts the
// rest timer (the others go straight into the next exercise).
export function setItemProps(block, index, letter) {
  if (block.format !== "superset") return {};
  const isLast = index === block.items.length - 1;
  const rest = Math.max(0, ...block.items.map((i) => i.rest_sec || 0));
  return {
    label: `${letter}${index + 1}`,
    restSec: isLast ? rest || null : 0, // null = no rest planned (use the default)
    nextLabel: isLast ? null : `${letter}${index + 2}`,
  };
}

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
  const hasAmount = item.reps || item.duration_sec || item.distance_m;
  if (isSetBased(format) && item.sets) volume.push(hasAmount ? `${item.sets} ×` : `${item.sets} sets`);
  if (item.reps) volume.push(item.reps);
  if (item.duration_sec) volume.push(formatDuration(item.duration_sec));
  if (item.exercise?.unilateral && (item.reps || item.duration_sec)) volume.push("each side");
  if (item.distance_m) volume.push(formatDistance(item.distance_m));
  if (volume.length) parts.push(volume.join(" "));
  if (item.load) parts.push(item.load);
  if (item.tempo) parts.push(`tempo ${item.tempo}`);
  if (isSetBased(format) && item.rest_sec) parts.push(`rest ${formatDuration(item.rest_sec)}`);
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

// For runs/rides/swims: "45" = 45 min, "45:30" = 45 min 30 s, "1:05:00" = 1 h 5 min.
export function parseActivityDuration(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => Number(p || 0));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// 3900 -> "1 h 05 min", 1830 -> "30:30"
export function formatActivityDuration(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return formatClock(sec);
}

export function formatKm(km) {
  const n = Number(km) || 0;
  return n >= 100 ? String(Math.round(n)) : String(+n.toFixed(1));
}

// ---------- Estimated workout time ----------
// Tuned on Florian's 1-to-1 sessions (about 19 sets of strength work ≈ 50 min):
// ~4 s per rep (10 reps if blank), the planned rest or 60 s, and 2 min to set
// up each exercise. One-sided exercises count both sides.
const SETUP_SEC = 120;
const REP_SEC = 4;
const REST_SEC = 60;
const SIDE_SWITCH_SEC = 10;
const leadingNumber = (text) => {
  const m = String(text ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

function itemWorkSec(it) {
  const t = it.exercise?.tracking;
  let work;
  if (it.duration_sec) work = it.duration_sec;
  else if (it.distance_m) work = it.distance_m * 0.3; // ~5 min per km
  else if (t === "time" || t === "weight_time" || t === "distance_time") work = 30;
  else work = (leadingNumber(it.reps) ?? 10) * REP_SEC;
  return it.exercise?.unilateral ? work * 2 + SIDE_SWITCH_SEC : work;
}

export function estimateWorkoutSec(blocks) {
  let total = 0;
  for (const b of blocks ?? []) {
    const items = b.items ?? [];
    const work = items.reduce((s, it) => s + itemWorkSec(it), 0);
    switch (b.format) {
      case "sets":
        for (const it of items) total += SETUP_SEC + (it.sets || 3) * (itemWorkSec(it) + (it.rest_sec ?? REST_SEC));
        break;
      case "superset": {
        if (!items.length) break;
        const rounds = Math.max(...items.map((it) => it.sets || 3));
        const rest = Math.max(0, ...items.map((it) => it.rest_sec || 0)) || REST_SEC;
        total += SETUP_SEC + (items.length - 1) * 30 + rounds * (work + rest);
        break;
      }
      case "circuit": {
        if (!items.length) break;
        const rounds = b.rounds || 3;
        total += SETUP_SEC + rounds * (work + items.length * 15) + (rounds - 1) * (b.rest_sec ?? REST_SEC);
        break;
      }
      case "intervals":
        total += SETUP_SEC + (b.rounds || 8) * ((b.work_sec || 40) + (b.rest_sec || 0));
        break;
      case "amrap":
        total += SETUP_SEC + (b.time_cap_sec || 600);
        break;
      case "emom":
        total += SETUP_SEC + (b.rounds || 10) * 60;
        break;
      default:
        break;
    }
  }
  return total;
}

// 2950 -> "≈ 50 min", 4500 -> "≈ 1 h 15 min" (rounded to 5 min)
export function formatEstimate(sec) {
  if (!sec) return "";
  const min = Math.max(5, Math.round(sec / 300) * 5);
  if (min < 60) return `≈ ${min} min`;
  const h = Math.floor(min / 60);
  return `≈ ${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
}

// ---------- Equipment ----------
export const EQUIPMENT = [
  "Barbell",
  "Dumbbell",
  "Kettlebell",
  "Cable",
  "Machine",
  "Smith machine",
  "Landmine",
  "Plate",
  "Medicine ball",
  "Slam ball",
  "Sandbag",
  "Band",
  "Physio ball",
  "TRX",
  "Sled",
  "Box / bench",
  "Rower",
  "Ski erg",
  "Bike",
  "Treadmill",
  "Bodyweight",
  "Other",
];

// "Dumbbell · each side" under an exercise name (equipment skipped when the
// name already says it, e.g. "Smith machine row").
export function exerciseMeta(ex) {
  if (!ex) return "";
  const eq = ex.equipment && !ex.name?.toLowerCase().includes(ex.equipment.toLowerCase()) ? ex.equipment : null;
  return [eq, ex.unilateral && "each side"].filter(Boolean).join(" · ");
}
