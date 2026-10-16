// Florian's weekly progression (see CLAUDE.md "coaching rules"):
// +2.5 kg per week on big lower-body lifts, +1 kg per week on upper-body lifts.
// Warm-up / cool-down / mobility blocks never progress, nor do core, cardio
// and mobility exercises, nor loads that aren't a plain kg number
// ("Bodyweight", "Plate 5", "70%-80% HR").

export const LOWER_STEP = 2.5;
export const UPPER_STEP = 1;

const FIXED_BLOCK = /^\s*(war[mn]?[\s,.-]*up|cool[\s-]*down|mobility|stretch)/i;
const CORE_NAME = /plank|sit.?up|crunch|twist|toe touch|pallof|trunk rotation|punch|dead bug|leg raise|knee raise|\bhold\b/i;
// Big lower-body lifts get the 2.5 kg step; smaller leg machines (adductor,
// leg curl, calf raise…) go up like upper-body lifts, by 1 kg.
const BIG_LOWER = /deadlift|squat|hip thrust|glute bridge|lunge|\brdl\b|step.?up|leg press|good morning/i;

// kg added per week for this exercise in this block (0 = stays the same).
export function weeklyStep(exercise, blockName) {
  if (!exercise || FIXED_BLOCK.test(blockName ?? "")) return 0;
  if (exercise.category !== "strength") return 0;
  if (CORE_NAME.test(exercise.name)) return 0;
  if (BIG_LOWER.test(exercise.name)) return LOWER_STEP;
  return UPPER_STEP;
}

// "20" + 2.5 -> "22.5"; "12,5" + 1 -> "13,5"; "40 kg" -> "42.5 kg".
// Anything that isn't a plain number (with optional kg) is left alone.
export function addKg(load, kg) {
  if (!kg || load == null) return load;
  const m = String(load).match(/^\s*(\d+(?:[.,]\d+)?)\s*(kg)?\s*$/i);
  if (!m) return load;
  const comma = m[1].includes(",");
  let next = String(+(Number(m[1].replace(",", ".")) + kg).toFixed(2));
  if (comma) next = next.replace(".", ",");
  return String(load).replace(m[1], next);
}
