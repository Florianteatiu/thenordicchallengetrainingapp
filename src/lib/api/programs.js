import { supabase } from "../supabaseClient";

// A client could in principle have more than one `programs` row (there's no
// uniqueness constraint on client_id in this schema) — we always treat the
// most recently created one as "the" active program.
export async function fetchProgramWithExercises(clientId) {
  const { data: programs, error } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const program = programs?.[0];
  if (!program) return null;

  const { data: exercises, error: exError } = await supabase
    .from("exercises")
    .select("*")
    .eq("program_id", program.id)
    .order("sort_order", { ascending: true });
  if (exError) throw exError;

  return { ...program, exercises };
}

export async function createProgram({ clientId, weekLabel, title, durationMin }) {
  const { data, error } = await supabase
    .from("programs")
    .insert({ client_id: clientId, week_label: weekLabel, title, duration_min: durationMin })
    .select()
    .single();
  if (error) throw error;
  return { ...data, exercises: [] };
}

export async function updateProgramMeta(programId, patch) {
  const { data, error } = await supabase.from("programs").update(patch).eq("id", programId).select().single();
  if (error) throw error;
  return data;
}

export async function addExercise(programId, sortOrder) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      program_id: programId,
      name: "New exercise",
      target_sets: 3,
      target_reps: "10-12",
      target_weight_kg: 0,
      rest_seconds: 60,
      cue: "Add a form cue for this exercise.",
      alternatives: [],
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExercise(exerciseId, patch) {
  const { data, error } = await supabase.from("exercises").update(patch).eq("id", exerciseId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(exerciseId) {
  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  if (error) throw error;
}
