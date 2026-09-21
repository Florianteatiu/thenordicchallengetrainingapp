import { supabase } from "../supabaseClient";

export async function fetchProgramWithExercises(clientId) {
  const { data: program, error } = await supabase.from("programs").select("*").eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  if (!program) return null;

  const { data: exercises, error: exError } = await supabase
    .from("exercises")
    .select("*")
    .eq("program_id", program.id)
    .order("order_index", { ascending: true });
  if (exError) throw exError;

  return { ...program, exercises };
}

export async function createProgram({ coachId, clientId, weekLabel, title, durationMin }) {
  const { data, error } = await supabase
    .from("programs")
    .insert({ coach_id: coachId, client_id: clientId, week_label: weekLabel, title, duration_min: durationMin })
    .select()
    .single();
  if (error) throw error;
  return { ...data, exercises: [] };
}

export async function updateProgramMeta(programId, patch) {
  const { data, error } = await supabase
    .from("programs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", programId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addExercise(programId, orderIndex) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      program_id: programId,
      name: "New exercise",
      target_sets: 3,
      target_reps: "10-12",
      target_weight: 0,
      rest_seconds: 60,
      cue: "Add a form cue for this exercise.",
      alternatives: [],
      order_index: orderIndex,
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
