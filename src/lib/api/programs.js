import { supabase } from "../supabaseClient";

// A client can have several `programs` rows over time (a coach can build one
// without disturbing the one their client currently sees) — the athlete app
// always shows whichever one has is_active = true. Falls back to the most
// recently created one if, for whatever reason, none is marked active.
export async function fetchProgramWithExercises(clientId) {
  const { data: active, error } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .limit(1);
  if (error) throw error;
  if (active?.[0]) return fetchProgramById(active[0].id);

  const { data: fallback, error: fallbackError } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (fallbackError) throw fallbackError;
  const program = fallback?.[0];
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

export async function createProgram({ coachId, clientId, weekLabel, title, durationMin, isActive }) {
  const { data, error } = await supabase
    .from("programs")
    .insert({ coach_id: coachId, client_id: clientId, week_label: weekLabel, title, duration_min: durationMin, is_active: isActive })
    .select()
    .single();
  if (error) throw error;
  return { ...data, exercises: [] };
}

// Makes `programId` the one thing the client sees, deactivating every other
// program of theirs. Two separate updates (not a single transaction) — an
// acceptable tradeoff for a coach-only, low-concurrency action.
export async function setActiveProgram(clientId, programId) {
  const { error: clearError } = await supabase
    .from("programs")
    .update({ is_active: false })
    .eq("client_id", clientId)
    .neq("id", programId);
  if (clearError) throw clearError;

  const { data, error } = await supabase.from("programs").update({ is_active: true }).eq("id", programId).select().single();
  if (error) throw error;
  return data;
}

export async function updateProgramMeta(programId, patch) {
  const { data, error } = await supabase.from("programs").update(patch).eq("id", programId).select().single();
  if (error) throw error;
  return data;
}

// Deletes exercises first rather than relying on an assumed cascade setting
// on the exercises -> programs foreign key. If a client already logged real
// sets against one of those exercises, that delete hits logged_sets'
// foreign key and fails — surfaced here as a clear message instead of a raw
// Postgres error. If the deleted program was the client's active one,
// promotes their next most recent remaining program so they don't end up
// with none.
export async function deleteProgram(programId) {
  const { data: target } = await supabase.from("programs").select("client_id, is_active").eq("id", programId).maybeSingle();

  const { error: exError } = await supabase.from("exercises").delete().eq("program_id", programId);
  if (exError) {
    if (exError.code === "23503") {
      throw new Error("This program has logged workout history attached to it and can't be deleted.");
    }
    throw exError;
  }
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) throw error;

  if (target?.is_active && target.client_id) {
    const { data: remaining } = await supabase
      .from("programs")
      .select("id")
      .eq("client_id", target.client_id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (remaining?.[0]) {
      await supabase.from("programs").update({ is_active: true }).eq("id", remaining[0].id);
    }
  }
}

// All of a client's programs (newest first), each with its exercise count —
// a client can have more than one over time; the most recent is what the
// athlete app shows them.
export async function fetchProgramsForClient(clientId) {
  const { data, error } = await supabase
    .from("programs")
    .select("*, exercises(count)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({ ...p, exerciseCount: p.exercises?.[0]?.count ?? 0 }));
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
export async function assignTemplateToClient(templateId, clientId, isActive) {
  const template = await fetchProgramById(templateId);

  const { data: newProgram, error: programError } = await supabase
    .from("programs")
    .insert({
      coach_id: template.coach_id,
      client_id: clientId,
      week_label: template.week_label,
      title: template.title,
      duration_min: template.duration_min,
      is_active: isActive,
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
