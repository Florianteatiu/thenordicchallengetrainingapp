import { supabase } from "./supabase";
import { programDayDate } from "./dates";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

// ---------- Profiles ----------

export async function getProfile(id) {
  return check(await supabase.from("profiles").select("*").eq("id", id).maybeSingle());
}

export async function getCoachProfile() {
  return check(await supabase.from("profiles").select("id, full_name, avatar_url").eq("role", "coach").maybeSingle());
}

export async function updateProfile(id, patch) {
  return check(await supabase.from("profiles").update(patch).eq("id", id).select().single());
}

export async function uploadAvatar(userId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  check(await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type }));
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return updateProfile(userId, { avatar_url: data.publicUrl });
}

export async function listClients() {
  return check(await supabase.from("profiles").select("*").eq("role", "client").order("full_name"));
}

// ---------- Exercise library ----------

export async function listExercises() {
  return check(await supabase.from("exercises").select("*").order("name"));
}

export async function saveExercise(exercise) {
  const { id, ...fields } = exercise;
  if (id) return check(await supabase.from("exercises").update(fields).eq("id", id).select().single());
  return check(await supabase.from("exercises").insert(fields).select().single());
}

export async function deleteExercise(id) {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error?.code === "23503") throw new Error("This exercise is used in a workout. Remove it from those workouts first.");
  if (error) throw error;
}

// ---------- Workouts ----------

const WORKOUT_SELECT = "*, workout_blocks(*, block_exercises(*, exercise:exercises(*)))";

function normalizeWorkout(w) {
  if (!w) return w;
  const { workout_blocks, ...rest } = w;
  const blocks = [...(workout_blocks ?? [])].sort(byPosition).map(({ block_exercises, ...b }) => ({
    ...b,
    items: [...(block_exercises ?? [])].sort(byPosition),
  }));
  return { ...rest, blocks };
}

export async function getWorkout(id) {
  return normalizeWorkout(check(await supabase.from("workouts").select(WORKOUT_SELECT).eq("id", id).single()));
}

export async function listWorkoutTemplates() {
  const rows = check(
    await supabase.from("workouts").select("id, title, description, updated_at, workout_blocks(format, block_exercises(id))").eq("is_template", true).order("title"),
  );
  return rows.map((w) => ({
    ...w,
    formats: [...new Set((w.workout_blocks ?? []).map((b) => b.format))],
    exerciseCount: (w.workout_blocks ?? []).reduce((n, b) => n + (b.block_exercises?.length ?? 0), 0),
  }));
}

export async function createWorkout({ title = "New workout", isTemplate = false } = {}) {
  return check(await supabase.from("workouts").insert({ title, is_template: isTemplate }).select().single());
}

export async function deleteWorkout(id) {
  check(await supabase.from("workouts").delete().eq("id", id));
}

export async function copyWorkout(id, asTemplate) {
  return check(await supabase.rpc("copy_workout", { p_workout_id: id, p_as_template: asTemplate }));
}

// Saves a whole workout as edited in the builder. Keeps existing row ids so
// sets a client already logged stay attached to the same exercise.
export async function saveWorkout(workout, original) {
  check(
    await supabase
      .from("workouts")
      .update({ title: workout.title, description: workout.description || null, updated_at: new Date().toISOString() })
      .eq("id", workout.id),
  );

  const keptBlockIds = new Set(workout.blocks.map((b) => b.id));
  const keptItemIds = new Set(workout.blocks.flatMap((b) => b.items.map((i) => i.id)));
  const removedItems = (original?.blocks ?? []).flatMap((b) => b.items).filter((i) => !keptItemIds.has(i.id)).map((i) => i.id);
  const removedBlocks = (original?.blocks ?? []).filter((b) => !keptBlockIds.has(b.id)).map((b) => b.id);

  if (removedItems.length) check(await supabase.from("block_exercises").delete().in("id", removedItems));
  if (removedBlocks.length) check(await supabase.from("workout_blocks").delete().in("id", removedBlocks));

  const blockRows = workout.blocks.map((b, i) => ({
    id: b.id,
    workout_id: workout.id,
    position: i,
    name: b.name || "",
    format: b.format,
    rounds: b.rounds ?? null,
    work_sec: b.work_sec ?? null,
    rest_sec: b.rest_sec ?? null,
    time_cap_sec: b.time_cap_sec ?? null,
    notes: b.notes || null,
  }));
  if (blockRows.length) check(await supabase.from("workout_blocks").upsert(blockRows));

  const itemRows = workout.blocks.flatMap((b) =>
    b.items.map((it, i) => ({
      id: it.id,
      block_id: b.id,
      exercise_id: it.exercise_id,
      position: i,
      sets: it.sets ?? null,
      reps: it.reps || null,
      load: it.load || null,
      duration_sec: it.duration_sec ?? null,
      distance_m: it.distance_m ?? null,
      rest_sec: it.rest_sec ?? null,
      tempo: it.tempo || null,
      notes: it.notes || null,
    })),
  );
  if (itemRows.length) check(await supabase.from("block_exercises").upsert(itemRows));

  return getWorkout(workout.id);
}

// ---------- Programs ----------

export async function listProgramTemplates() {
  return check(await supabase.from("programs").select("*, program_days(id)").eq("is_template", true).order("title"));
}

export async function listClientPrograms(clientId) {
  return check(
    await supabase.from("programs").select("*, program_days(id)").eq("client_id", clientId).order("created_at", { ascending: false }),
  );
}

export async function listActivePrograms() {
  return check(await supabase.from("programs").select("id, title, client_id, start_date, weeks, program_days(id, week, day)").eq("status", "active"));
}

// Program with its days; each day carries a light summary of its workout.
export async function getProgram(id) {
  const program = check(
    await supabase
      .from("programs")
      .select("*, program_days(*, workout:workouts(id, title, workout_blocks(format, block_exercises(id))))")
      .eq("id", id)
      .single(),
  );
  const days = [...(program.program_days ?? [])]
    .sort((a, b) => a.week - b.week || a.day - b.day || a.position - b.position)
    .map((d) => ({
      ...d,
      date: programDayDate(program.start_date, d.week, d.day),
      formats: [...new Set((d.workout?.workout_blocks ?? []).map((b) => b.format))],
      exerciseCount: (d.workout?.workout_blocks ?? []).reduce((n, b) => n + (b.block_exercises?.length ?? 0), 0),
    }));
  delete program.program_days;
  return { ...program, days };
}

export async function createProgram({ title = "New program", weeks = 4, isTemplate = false, clientId = null, startDate = null }) {
  return check(
    await supabase
      .from("programs")
      .insert({ title, weeks, is_template: isTemplate, client_id: clientId, start_date: startDate })
      .select()
      .single(),
  );
}

export async function updateProgram(id, patch) {
  return check(await supabase.from("programs").update(patch).eq("id", id).select().single());
}

export async function deleteProgram(id) {
  check(await supabase.from("programs").delete().eq("id", id));
}

export async function copyProgram({ programId, clientId = null, startDate = null, asTemplate = false }) {
  return check(
    await supabase.rpc("copy_program", {
      p_program_id: programId,
      p_client_id: clientId,
      p_start_date: startDate,
      p_as_template: asTemplate,
      p_status: "draft",
    }),
  );
}

export async function activateProgram(id) {
  check(await supabase.rpc("activate_program", { p_program_id: id }));
}

export async function copyWeek(programId, fromWeek, toWeek) {
  check(await supabase.rpc("copy_week", { p_program_id: programId, p_from_week: fromWeek, p_to_week: toWeek }));
}

export async function addTemplateToDay(programId, week, day, workoutId) {
  return check(await supabase.rpc("add_workout_to_day", { p_program_id: programId, p_week: week, p_day: day, p_workout_id: workoutId }));
}

export async function addBlankWorkoutToDay(programId, week, day) {
  const workout = await createWorkout({ title: "New workout" });
  check(await supabase.from("program_days").insert({ program_id: programId, week, day, workout_id: workout.id }));
  return workout;
}

export async function moveProgramDay(id, week, day) {
  check(await supabase.from("program_days").update({ week, day }).eq("id", id));
}

export async function removeProgramDay(id) {
  check(await supabase.from("program_days").delete().eq("id", id));
}

export async function removeWeek(programId, week, totalWeeks) {
  check(await supabase.from("program_days").delete().eq("program_id", programId).eq("week", week));
  // Shift later weeks up so there's no gap.
  const later = check(await supabase.from("program_days").select("id, week").eq("program_id", programId).gt("week", week));
  for (const d of later) check(await supabase.from("program_days").update({ week: d.week - 1 }).eq("id", d.id));
  return updateProgram(programId, { weeks: Math.max(1, totalWeeks - 1) });
}

// ---------- Client: plan & sessions ----------

export async function getActiveProgramFor(clientId) {
  const row = check(
    await supabase.from("programs").select("id").eq("client_id", clientId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  );
  return row ? getProgram(row.id) : null;
}

export async function listSessions(clientId, { limit = 200 } = {}) {
  return check(
    await supabase.from("workout_sessions").select("*").eq("client_id", clientId).order("started_at", { ascending: false }).limit(limit),
  );
}

export async function listRecentSessionsAll(sinceIso) {
  return check(await supabase.from("workout_sessions").select("*").gte("started_at", sinceIso).order("started_at", { ascending: false }));
}

export async function getProgramDay(id) {
  return check(await supabase.from("program_days").select("*, program:programs(id, title, start_date)").eq("id", id).single());
}

export async function findSession(clientId, programDayId) {
  return check(await supabase.from("workout_sessions").select("*").eq("client_id", clientId).eq("program_day_id", programDayId).maybeSingle());
}

export async function getOrCreateSession({ clientId, programDay, workout }) {
  const existing = await findSession(clientId, programDay.id);
  if (existing) return existing;
  return check(
    await supabase
      .from("workout_sessions")
      .insert({
        client_id: clientId,
        program_day_id: programDay.id,
        workout_id: workout.id,
        workout_title: workout.title,
        scheduled_date: programDayDate(programDay.program?.start_date, programDay.week, programDay.day),
      })
      .select()
      .single(),
  );
}

export async function getSessionLogs(sessionId) {
  const [sets, blocks] = await Promise.all([
    supabase.from("set_logs").select("*").eq("session_id", sessionId),
    supabase.from("block_logs").select("*").eq("session_id", sessionId),
  ]);
  return { sets: check(sets), blocks: check(blocks) };
}

export async function upsertSetLog(row) {
  return check(await supabase.from("set_logs").upsert(row, { onConflict: "session_id,block_exercise_id,set_number" }).select().single());
}

export async function deleteSetLog(sessionId, blockExerciseId, setNumber) {
  check(await supabase.from("set_logs").delete().eq("session_id", sessionId).eq("block_exercise_id", blockExerciseId).eq("set_number", setNumber));
}

export async function upsertBlockLog(row) {
  return check(await supabase.from("block_logs").upsert(row, { onConflict: "session_id,block_id" }).select().single());
}

export async function completeSession(id, { rpe, feeling, notes }) {
  return check(
    await supabase
      .from("workout_sessions")
      .update({ completed_at: new Date().toISOString(), rpe, feeling, notes: notes || null })
      .eq("id", id)
      .select()
      .single(),
  );
}

// Most recent logged sets per exercise, from sessions other than `excludeSessionId`.
export async function getLastPerformance(clientId, exerciseIds, excludeSessionId) {
  if (!exerciseIds.length) return {};
  const rows = check(
    await supabase
      .from("set_logs")
      .select("exercise_id, set_number, reps, load_kg, duration_sec, distance_m, created_at, session_id, session:workout_sessions!inner(client_id)")
      .in("exercise_id", exerciseIds)
      .eq("session.client_id", clientId)
      .neq("session_id", excludeSessionId)
      .order("created_at", { ascending: false })
      .limit(300),
  );
  const result = {};
  for (const r of rows) {
    const entry = result[r.exercise_id];
    if (!entry) result[r.exercise_id] = { sessionId: r.session_id, date: r.created_at, sets: [r], bestKg: r.load_kg ?? 0 };
    else {
      if (entry.sessionId === r.session_id) entry.sets.push(r);
      entry.bestKg = Math.max(entry.bestKg, r.load_kg ?? 0);
    }
  }
  for (const e of Object.values(result)) e.sets.sort((a, b) => a.set_number - b.set_number);
  return result;
}

export async function getSessionDetail(sessionId) {
  const session = check(await supabase.from("workout_sessions").select("*").eq("id", sessionId).single());
  const [logs, workout] = await Promise.all([getSessionLogs(sessionId), session.workout_id ? getWorkout(session.workout_id).catch(() => null) : null]);
  return { session, workout, ...logs };
}
