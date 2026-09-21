import { supabase } from "../supabaseClient";
import { todayStr, formatDateLabel } from "../dateUtils";

export async function getOrCreateTodaySession(clientId, programId) {
  const date = todayStr();
  const { data: existing, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("client_id", clientId)
    .eq("session_date", date)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("workout_sessions")
    .insert({ client_id: clientId, program_id: programId, session_date: date })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function fetchSetLogs(sessionId) {
  const { data, error } = await supabase.from("set_logs").select("*").eq("session_id", sessionId);
  if (error) throw error;
  return data;
}

// Creates any missing set_log rows for the given exercises so today's
// session always has one row per target set, seeded with the target weight.
export async function ensureSetLogsForExercises(sessionId, exercises) {
  const existing = await fetchSetLogs(sessionId);
  const existingKeys = new Set(existing.map((s) => `${s.exercise_id}:${s.set_number}`));
  const toInsert = [];
  exercises.forEach((ex) => {
    for (let i = 1; i <= ex.target_sets; i++) {
      const key = `${ex.id}:${i}`;
      if (!existingKeys.has(key)) {
        toInsert.push({
          session_id: sessionId,
          exercise_id: ex.id,
          set_number: i,
          weight: ex.target_weight,
          reps: null,
          done: false,
        });
      }
    }
  });
  if (toInsert.length === 0) return existing;
  const { data, error } = await supabase.from("set_logs").insert(toInsert).select();
  if (error) throw error;
  return [...existing, ...data];
}

export async function updateSetLog(id, patch) {
  const { data, error } = await supabase
    .from("set_logs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addExtraSet(sessionId, exerciseId, setNumber, weight) {
  const { data, error } = await supabase
    .from("set_logs")
    .insert({ session_id: sessionId, exercise_id: exerciseId, set_number: setNumber, weight, reps: null, done: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSessionMood(sessionId, mood) {
  const { data, error } = await supabase.from("workout_sessions").update({ mood }).eq("id", sessionId).select().single();
  if (error) throw error;
  return data;
}

export async function setSessionCompleted(sessionId, completed) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Awards XP for a finished session exactly once (guarded by xp_awarded).
export async function awardXPOnce(session, clientId, xpEarned) {
  if (session.xp_awarded || xpEarned <= 0) return null;
  const { data: claimed, error: claimError } = await supabase
    .from("workout_sessions")
    .update({ xp_awarded: true })
    .eq("id", session.id)
    .eq("xp_awarded", false)
    .select();
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return null; // already claimed elsewhere

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("xp_base")
    .eq("id", clientId)
    .single();
  if (profileError) throw profileError;

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ xp_base: (profile.xp_base || 0) + xpEarned })
    .eq("id", clientId)
    .select()
    .single();
  if (updateError) throw updateError;
  return updated;
}

// All sessions (with their set logs) for a client since a given date, used
// for streak/weekly-stat computation and the coach's activity log.
export async function fetchRecentSessions(clientId, sinceDate) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*, set_logs(*)")
    .eq("client_id", clientId)
    .gte("session_date", sinceDate)
    .order("session_date", { ascending: false });
  if (error) throw error;
  return data;
}

// Recent sessions across several clients at once, grouped by client_id — used
// to compute each client's streak/today-status for the coach's client list.
export async function fetchRecentSessionsForClients(clientIds, sinceDate) {
  if (clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*, set_logs(*)")
    .in("client_id", clientIds)
    .gte("session_date", sinceDate)
    .order("session_date", { ascending: false });
  if (error) throw error;

  const byClient = {};
  clientIds.forEach((id) => (byClient[id] = []));
  data.forEach((s) => {
    byClient[s.client_id].push(s);
  });
  return byClient;
}

// Top-set weight per day for a single exercise, for the history chart.
export async function fetchExerciseHistory(exerciseId) {
  const { data, error } = await supabase
    .from("set_logs")
    .select("weight, done, workout_sessions!inner(session_date)")
    .eq("exercise_id", exerciseId)
    .eq("done", true);
  if (error) throw error;

  const byDate = new Map();
  data.forEach((row) => {
    const date = row.workout_sessions.session_date;
    const w = Number(row.weight) || 0;
    if (!byDate.has(date) || byDate.get(date) < w) byDate.set(date, w);
  });
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, weight]) => ({ date: formatDateLabel(date), weight }));
}
