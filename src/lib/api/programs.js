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
  return fetchProgramById(program.id);
}

export async function fetchProgramById(programId) {
  const { data: program, error } = await supabase.from("programs").select("*").eq("id", programId).single();
  if (error) throw error;

  const { data: exercises, error: exError } = await supabase
    .from("exercises")
    .select("*")
    .eq("program_id", program.id)
    .order("sort_order", { ascending: true });
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
  const { data, error } = await supabase.from("programs").update(patch).eq("id", programId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProgram(programId) {
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) throw error;
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

// ---------- Program templates (client_id is null until assigned) ----------

export async function fetchTemplatesForCoach(coachId) {
  const { data, error } = await supabase
    .from("programs")
    .select("*, exercises(count)")
    .eq("coach_id", coachId)
    .is("client_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({ ...p, exerciseCount: p.exercises?.[0]?.count ?? 0 }));
}

export async function createTemplate({ coachId, weekLabel, title, durationMin }) {
  const { data, error } = await supabase
    .from("programs")
    .insert({ coach_id: coachId, client_id: null, week_label: weekLabel, title, duration_min: durationMin })
    .select()
    .single();
  if (error) throw error;
  return { ...data, exercises: [] };
}

// Clones a template's program row + all its exercises into a brand new
// program assigned to a specific client, leaving the original template
// untouched and reusable for future clients.
export async function assignTemplateToClient(templateId, clientId) {
  const template = await fetchProgramById(templateId);

  const { data: newProgram, error: programError } = await supabase
    .from("programs")
    .insert({
      coach_id: template.coach_id,
      client_id: clientId,
      week_label: template.week_label,
      title: template.title,
      duration_min: template.duration_min,
    })
    .select()
    .single();
  if (programError) throw programError;

  if (template.exercises.length === 0) return { ...newProgram, exercises: [] };

  const { data: newExercises, error: exercisesError } = await supabase
    .from("exercises")
    .insert(
      template.exercises.map((ex) => ({
        program_id: newProgram.id,
        name: ex.name,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight_kg: ex.target_weight_kg,
        rest_seconds: ex.rest_seconds,
        cue: ex.cue,
        alternatives: ex.alternatives,
        sort_order: ex.sort_order,
      }))
    )
    .select();
  if (exercisesError) throw exercisesError;

  return { ...newProgram, exercises: newExercises.sort((a, b) => a.sort_order - b.sort_order) };
}
