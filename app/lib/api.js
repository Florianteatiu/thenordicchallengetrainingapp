import { supabase } from "./supabase";
import { programDayDate } from "./dates";
import { estimateWorkoutSec } from "./format";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

// ---------- Profiles ----------

export async function getProfile(id) {
  return check(await supabase.from("profiles").select("*").eq("id", id).maybeSingle());
}

// Coach sets a temporary password for a client (no email involved).
export async function resetClientPassword(clientId, password) {
  check(await supabase.rpc("coach_reset_password", { p_client_id: clientId, p_password: password }));
}

// Client has chosen their own password after a coach reset.
export async function markPasswordChanged() {
  check(await supabase.rpc("password_changed"));
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

// Just enough of a workout to estimate how long it takes.
const ESTIMATE_BLOCK_FIELDS =
  "format, rounds, work_sec, rest_sec, time_cap_sec, block_exercises(id, sets, reps, duration_sec, distance_m, rest_sec, exercise:exercises(tracking, unilateral))";
const estimateFromRows = (blocks) => estimateWorkoutSec((blocks ?? []).map(({ block_exercises, ...b }) => ({ ...b, items: block_exercises ?? [] })));

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
    await supabase
      .from("workouts")
      .select(
        `id, title, description, updated_at, workout_blocks(${ESTIMATE_BLOCK_FIELDS})`,
      )
      .eq("is_template", true)
      .order("title"),
  );
  return rows.map((w) => ({
    ...w,
    estimateSec: estimateFromRows(w.workout_blocks),
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
      .select(`*, program_days(*, workout:workouts(id, title, workout_blocks(${ESTIMATE_BLOCK_FIELDS})))`)
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
      estimateSec: estimateFromRows(d.workout?.workout_blocks),
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
  notify("program", id);
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
  const saved = check(
    await supabase
      .from("workout_sessions")
      .update({ completed_at: new Date().toISOString(), rpe, feeling, notes: notes || null })
      .eq("id", id)
      .select()
      .single(),
  );
  notify("workout", id);
  return saved;
}

// Most recent logged sets per exercise, from sessions other than `excludeSessionId`.
export async function getLastPerformance(clientId, exerciseIds, excludeSessionId) {
  if (!exerciseIds.length) return {};
  const rows = check(
    await supabase
      .from("set_logs")
      .select("exercise_id, set_number, reps, load_kg, duration_sec, distance_m, rest_sec, created_at, session_id, session:workout_sessions!inner(client_id)")
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

// ---------- Messages (chat) ----------

export async function listMessages(clientId, { limit = 200 } = {}) {
  const rows = check(
    await supabase.from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(limit),
  );
  return rows.reverse();
}

// Latest message + unread count per conversation, for the coach's inbox.
export async function listConversations() {
  const rows = check(await supabase.from("messages").select("id, client_id, sender_id, body, audio_path, read_at, created_at").order("created_at", { ascending: false }).limit(1000));
  const byClient = {};
  for (const m of rows) {
    const c = (byClient[m.client_id] ??= { clientId: m.client_id, last: m, unread: 0 });
    if (!m.read_at && m.sender_id === m.client_id) c.unread += 1;
  }
  return byClient;
}

export async function countUnread(clientId, myId) {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function sendMessage({ clientId, body = null, audioPath = null, audioDurationSec = null, sessionId = null, setLogId = null, contextLabel = null }) {
  const message = check(
    await supabase
      .from("messages")
      .insert({
        client_id: clientId,
        body: body?.trim() || null,
        audio_path: audioPath,
        audio_duration_sec: audioDurationSec,
        session_id: sessionId,
        set_log_id: setLogId,
        context_label: contextLabel,
      })
      .select()
      .single(),
  );
  notify("message", message.id);
  return message;
}

export async function deleteMessage(id) {
  check(await supabase.from("messages").delete().eq("id", id));
}

export async function markMessagesRead(clientId) {
  check(await supabase.rpc("mark_messages_read", { p_client_id: clientId }));
}

export async function uploadVoiceNote(clientId, blob) {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  check(await supabase.storage.from("voice-notes").upload(path, blob, { contentType: blob.type || "audio/webm" }));
  return path;
}

const signedCache = new Map();
// Short-lived links to private files (voice notes, check-in photos).
export async function signedUrl(bucket, path) {
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function subscribeToMessages(clientId, onChange) {
  const channel = supabase
    .channel(`messages-${clientId ?? "all"}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}) },
      (payload) => onChange(payload),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Weekly check-ins ----------

export async function listCheckins(clientId) {
  return check(await supabase.from("checkins").select("*").eq("client_id", clientId).order("week_start", { ascending: false }));
}

export async function listRecentCheckinsAll(sinceIso) {
  return check(await supabase.from("checkins").select("*").gte("week_start", sinceIso).order("created_at", { ascending: false }));
}

export async function saveCheckin(row) {
  const { id, ...fields } = row;
  let saved;
  if (id) saved = check(await supabase.from("checkins").update(fields).eq("id", id).select().single());
  else {
    saved = check(await supabase.from("checkins").insert(fields).select().single());
    notify("checkin", saved.id);
  }
  return saved;
}

export async function replyToCheckin(id, reply) {
  const saved = check(await supabase.from("checkins").update({ coach_reply: reply }).eq("id", id).select().single());
  if (saved.coach_reply) notify("checkin_reply", id);
  return saved;
}

export async function uploadCheckinPhoto(clientId, file) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  check(await supabase.storage.from("checkin-photos").upload(path, file, { contentType: file.type || "image/jpeg" }));
  return path;
}

// ---------- Cross Sweden journey ----------

export async function listActivities(clientId) {
  return check(await supabase.from("activities").select("*").eq("client_id", clientId).order("activity_date", { ascending: false }).order("created_at", { ascending: false }));
}

export async function logActivity({ kind, distanceKm, durationSec = null, date, notes = null }) {
  return check(
    await supabase
      .from("activities")
      .insert({ kind, distance_km: distanceKm, duration_sec: durationSec, activity_date: date, notes: notes?.trim() || null })
      .select()
      .single(),
  );
}

export async function deleteActivity(id) {
  check(await supabase.from("activities").delete().eq("id", id));
}

export async function getJourneyTotals(clientId) {
  const rows = check(await supabase.rpc("journey_totals", { p_client_id: clientId }));
  const totals = { run: 0, bike: 0, swim: 0 };
  for (const r of rows ?? []) totals[r.kind] = Number(r.km) || 0;
  return totals;
}

// ---------- Lift progress ----------

// Every logged weighted set for one client, oldest first, with exercise name.
export async function listWeightedSets(clientId) {
  return check(
    await supabase
      .from("set_logs")
      .select("exercise_id, reps, load_kg, created_at, session_id, exercise:exercises(name, equipment), session:workout_sessions!inner(client_id)")
      .eq("session.client_id", clientId)
      .not("load_kg", "is", null)
      .gt("load_kg", 0)
      .order("created_at", { ascending: true })
      .limit(5000),
  );
}

// ---------- In-person coaching (the Nordic PT app) ----------

export async function listPtClients() {
  const [clients, sessions] = await Promise.all([
    supabase.from("pt_clients").select("*").order("full_name"),
    supabase.from("pt_sessions").select("client_id, session_date").order("session_date", { ascending: false }).limit(5000),
  ]);
  const stats = {};
  for (const s of check(sessions)) {
    const st = (stats[s.client_id] ??= { count: 0, last: s.session_date });
    st.count += 1;
  }
  return check(clients).map((c) => ({ ...c, sessionCount: stats[c.id]?.count ?? 0, lastSession: stats[c.id]?.last ?? null }));
}

export async function getPtClient(id) {
  return check(await supabase.from("pt_clients").select("*").eq("id", id).single());
}

export async function savePtClient(client) {
  const { id, ...fields } = client;
  if (id) return check(await supabase.from("pt_clients").update(fields).eq("id", id).select().single());
  return check(await supabase.from("pt_clients").insert(fields).select().single());
}

export async function deletePtClient(id) {
  check(await supabase.from("pt_clients").delete().eq("id", id));
}

export async function listPtSessions(clientId) {
  return check(
    await supabase
      .from("pt_sessions")
      .select("*, workout:workouts(title), group_session:pt_group_sessions(group_name)")
      .eq("client_id", clientId)
      .order("session_date", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(500),
  );
}

export async function getPtSession(id) {
  return check(await supabase.from("pt_sessions").select("*, client:pt_clients(id, full_name)").eq("id", id).single());
}

// Starts a session for a client on a date. `fromWorkoutId` (a template, or the
// workout of an earlier session) is copied so the session owns its version;
// without it the session starts empty.
export async function createPtSession({ clientId, date, fromWorkoutId = null }) {
  const workout = fromWorkoutId ? await getWorkout(await copyWorkout(fromWorkoutId, false)) : await createWorkout({ title: "Session" });
  return check(
    await supabase
      .from("pt_sessions")
      .insert({ client_id: clientId, session_date: date, workout_id: workout.id, workout_title: workout.title })
      .select()
      .single(),
  );
}

export async function updatePtSession(id, patch) {
  return check(await supabase.from("pt_sessions").update(patch).eq("id", id).select().single());
}

export async function deletePtSession(id) {
  check(await supabase.from("pt_sessions").delete().eq("id", id));
}

export async function getPtSessionLogs(sessionId) {
  const [sets, blocks] = await Promise.all([
    supabase.from("pt_set_logs").select("*").eq("session_id", sessionId),
    supabase.from("pt_block_logs").select("*").eq("session_id", sessionId),
  ]);
  return { sets: check(sets), blocks: check(blocks) };
}

export async function upsertPtSetLog(row) {
  return check(await supabase.from("pt_set_logs").upsert(row, { onConflict: "session_id,block_exercise_id,set_number" }).select().single());
}

export async function deletePtSetLog(sessionId, blockExerciseId, setNumber) {
  check(await supabase.from("pt_set_logs").delete().eq("session_id", sessionId).eq("block_exercise_id", blockExerciseId).eq("set_number", setNumber));
}

export async function upsertPtBlockLog(row) {
  return check(await supabase.from("pt_block_logs").upsert(row, { onConflict: "session_id,block_id" }).select().single());
}

// Same shape as getLastPerformance, for an in-person client. "Last" goes by
// session date, so backdated sessions land in the right place.
export async function getPtLastPerformance(clientId, exerciseIds, excludeSessionId) {
  if (!exerciseIds.length) return {};
  const rows = check(
    await supabase
      .from("pt_set_logs")
      .select("exercise_id, set_number, reps, load_kg, duration_sec, distance_m, rest_sec, session_id, session:pt_sessions!inner(client_id, session_date, started_at)")
      .in("exercise_id", exerciseIds)
      .eq("session.client_id", clientId)
      .neq("session_id", excludeSessionId)
      .limit(2000),
  );
  const newest = (r) => `${r.session.session_date} ${r.session.started_at}`;
  rows.sort((a, b) => newest(b).localeCompare(newest(a)));
  const result = {};
  for (const r of rows) {
    const entry = result[r.exercise_id];
    if (!entry) result[r.exercise_id] = { sessionId: r.session_id, date: r.session.session_date, sets: [r], bestKg: r.load_kg ?? 0 };
    else {
      if (entry.sessionId === r.session_id) entry.sets.push(r);
      entry.bestKg = Math.max(entry.bestKg, r.load_kg ?? 0);
    }
  }
  for (const e of Object.values(result)) e.sets.sort((a, b) => a.set_number - b.set_number);
  return result;
}

// Weighted sets for the lift charts, dated by the session (not by when they
// were typed in).
export async function listPtWeightedSets(clientId) {
  const rows = check(
    await supabase
      .from("pt_set_logs")
      .select("exercise_id, reps, load_kg, session_id, exercise:exercises(name, equipment), session:pt_sessions!inner(client_id, session_date)")
      .eq("session.client_id", clientId)
      .not("load_kg", "is", null)
      .gt("load_kg", 0)
      .limit(5000),
  );
  return rows.map((r) => ({ ...r, created_at: r.session.session_date })).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Adds an exercise to a session's workout on the spot: into the last
// straight-sets block, or a new one if there is none.
export async function addExerciseToWorkout(workout, exercise) {
  let block = [...workout.blocks].reverse().find((b) => b.format === "sets");
  if (!block) {
    block = check(
      await supabase.from("workout_blocks").insert({ workout_id: workout.id, position: workout.blocks.length, name: "", format: "sets" }).select().single(),
    );
    block.items = [];
  }
  check(
    await supabase.from("block_exercises").insert({
      block_id: block.id,
      exercise_id: exercise.id,
      position: block.items.length,
      sets: exercise.tracking === "weight_reps" || exercise.tracking === "reps" ? 3 : 1,
    }),
  );
  return getWorkout(workout.id);
}

// ---------- Nordic PT: small groups ----------

export async function listPtGroups() {
  const [groups, sessions] = await Promise.all([
    supabase.from("pt_groups").select("*, members:pt_group_members(client:pt_clients(id, full_name))").order("name"),
    supabase.from("pt_group_sessions").select("group_id, session_date").order("session_date", { ascending: false }).limit(2000),
  ]);
  const last = {};
  for (const s of check(sessions)) if (s.group_id && !last[s.group_id]) last[s.group_id] = s.session_date;
  return check(groups).map((g) => ({ ...g, members: g.members.map((m) => m.client), lastSession: last[g.id] ?? null }));
}

export async function getPtGroup(id) {
  const [group, sessions] = await Promise.all([
    supabase.from("pt_groups").select("*, members:pt_group_members(position, client:pt_clients(*))").eq("id", id).single(),
    supabase
      .from("pt_group_sessions")
      .select("*, sessions:pt_sessions(id, client_id, workout_title, workout_id)")
      .eq("group_id", id)
      .order("session_date", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(200),
  ]);
  const g = check(group);
  return {
    ...g,
    members: [...g.members].sort((a, b) => a.position - b.position || a.client.full_name.localeCompare(b.client.full_name)).map((m) => m.client),
    sessions: check(sessions),
  };
}

export async function savePtGroup(group) {
  const { id, ...fields } = group;
  if (id) return check(await supabase.from("pt_groups").update(fields).eq("id", id).select().single());
  return check(await supabase.from("pt_groups").insert(fields).select().single());
}

export async function deletePtGroup(id) {
  check(await supabase.from("pt_groups").delete().eq("id", id));
}

export async function setPtGroupMembers(groupId, clientIds) {
  check(await supabase.from("pt_group_members").delete().eq("group_id", groupId));
  if (clientIds.length)
    check(await supabase.from("pt_group_members").insert(clientIds.map((client_id, position) => ({ group_id: groupId, client_id, position }))));
}

// Starts a group session: one shared copy per workout option, and one
// ordinary pt_session per person present. `options` = [{ fromWorkoutId, clientIds }]
// (one or two of them: workout A and optionally B).
export async function startPtGroupSession({ group, date, options }) {
  const gs = check(await supabase.from("pt_group_sessions").insert({ group_id: group.id, group_name: group.name, session_date: date }).select().single());
  try {
    for (const opt of options) {
      if (!opt.clientIds.length) continue;
      const workout = opt.fromWorkoutId ? await getWorkout(await copyWorkout(opt.fromWorkoutId, false)) : await createWorkout({ title: `${group.name} session` });
      check(
        await supabase.from("pt_sessions").insert(
          opt.clientIds.map((client_id) => ({
            client_id,
            session_date: date,
            workout_id: workout.id,
            workout_title: workout.title,
            group_session_id: gs.id,
          })),
        ),
      );
    }
  } catch (e) {
    await supabase.from("pt_group_sessions").delete().eq("id", gs.id);
    throw e;
  }
  return gs;
}

// Everything the live group screen needs, in one go.
export async function getPtGroupSession(id) {
  const [gs, members] = await Promise.all([
    supabase.from("pt_group_sessions").select("*").eq("id", id).single(),
    supabase.from("pt_sessions").select("*, client:pt_clients(id, full_name, injuries)").eq("group_session_id", id).order("started_at"),
  ]);
  const session = check(gs);
  const people = check(members).sort((a, b) => a.client.full_name.localeCompare(b.client.full_name));
  const workoutIds = [...new Set(people.map((p) => p.workout_id).filter(Boolean))];
  const ids = people.map((p) => p.id);
  const [workouts, sets, blocks] = await Promise.all([
    Promise.all(workoutIds.map((w) => getWorkout(w))),
    ids.length ? supabase.from("pt_set_logs").select("*").in("session_id", ids) : { data: [] },
    ids.length ? supabase.from("pt_block_logs").select("*").in("session_id", ids) : { data: [] },
  ]);
  // Each person's last numbers, from any earlier session (1-to-1 or group).
  const last = {};
  await Promise.all(
    people.map(async (p) => {
      const w = workouts.find((x) => x.id === p.workout_id);
      const exerciseIds = [...new Set((w?.blocks ?? []).flatMap((b) => b.items.map((i) => i.exercise_id)))];
      last[p.id] = await getPtLastPerformance(p.client_id, exerciseIds, p.id);
    }),
  );
  return { session, people, workouts, sets: check(sets), blocks: check(blocks), last };
}

export async function addPtGroupSessionMember({ groupSession, clientId, workout }) {
  return check(
    await supabase
      .from("pt_sessions")
      .insert({
        client_id: clientId,
        session_date: groupSession.session_date,
        workout_id: workout.id,
        workout_title: workout.title,
        group_session_id: groupSession.id,
        completed_at: groupSession.completed_at,
      })
      .select("*, client:pt_clients(id, full_name, injuries)")
      .single(),
  );
}

export async function updatePtGroupSession(id, patch) {
  return check(await supabase.from("pt_group_sessions").update(patch).eq("id", id).select().single());
}

// Marks the group session and everyone's session in it as done (or re-opens).
export async function setPtGroupSessionDone(id, done) {
  const at = done ? new Date().toISOString() : null;
  check(await supabase.from("pt_sessions").update({ completed_at: at }).eq("group_session_id", id));
  return updatePtGroupSession(id, { completed_at: at });
}

export async function deletePtGroupSession(id) {
  check(await supabase.from("pt_group_sessions").delete().eq("id", id));
}

export async function listPtNotes(clientId) {
  return check(await supabase.from("pt_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }));
}

export async function addPtNote(clientId, body) {
  return check(await supabase.from("pt_notes").insert({ client_id: clientId, body: body.trim() }).select().single());
}

export async function updatePtNote(id, patch) {
  return check(await supabase.from("pt_notes").update(patch).eq("id", id).select().single());
}

export async function deletePtNote(id) {
  check(await supabase.from("pt_notes").delete().eq("id", id));
}

// ---------- Exercise videos ----------

export async function uploadExerciseVideo(exerciseId, file) {
  const ext = (file.name?.split(".").pop() || "mp4").toLowerCase();
  const path = `${exerciseId}/${Date.now()}.${ext}`;
  check(await supabase.storage.from("exercise-videos").upload(path, file, { contentType: file.type || "video/mp4" }));
  return supabase.storage.from("exercise-videos").getPublicUrl(path).data.publicUrl;
}

// ---------- Push notifications ----------

// Asks the notify function to tell the other side about something that just
// happened. Fire-and-forget: a notification failing must never break the
// action itself.
export function notify(type, id) {
  supabase.functions.invoke("notify", { body: { type, id } }).catch(() => {});
}

export async function savePushSubscription(sub) {
  const json = sub.toJSON();
  check(
    await supabase
      .from("push_subscriptions")
      .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: "endpoint" }),
  );
}

export async function deletePushSubscription(endpoint) {
  check(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint));
}

export async function listSessionComments(sessionId) {
  return check(await supabase.from("messages").select("*").eq("session_id", sessionId).order("created_at"));
}

// ---------- Challenge calendar ----------

export async function listEvents() {
  return check(await supabase.from("events").select("*").order("starts_on"));
}

export async function saveEvent(event) {
  const { id, created_at: _created, ...fields } = event;
  if (id) return check(await supabase.from("events").update(fields).eq("id", id).select().single());
  return check(await supabase.from("events").insert(fields).select().single());
}

export async function deleteEvent(id) {
  check(await supabase.from("events").delete().eq("id", id));
}
