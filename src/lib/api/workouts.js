import { supabase } from "../supabaseClient";
import { todayStr, formatDateLabel } from "../dateUtils";

// ---------- logged_sets: each row IS one completed set (insert-on-log, no
// pre-seeded placeholder rows and no separate "done" flag) ----------

export async function logSet({ clientId, exerciseId, setNumber, weightKg, reps }) {
  const { data, error } = await supabase
    .from("logged_sets")
    .insert({ client_id: clientId, exercise_id: exerciseId, set_number: setNumber, weight_kg: weightKg, reps })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLoggedSet(id, patch) {
  const { data, error } = await supabase.from("logged_sets").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLoggedSet(id) {
  const { error } = await supabase.from("logged_sets").delete().eq("id", id);
  if (error) throw error;
}

// All logged sets for a client since a given date — used for streak/weekly
// stats and the coach's activity log.
export async function fetchRecentLoggedSets(clientId, sinceDate) {
  const { data, error } = await supabase
    .from("logged_sets")
    .select("*")
    .eq("client_id", clientId)
    .gte("logged_at", sinceDate)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Same, batched across several clients at once (for the coach's client list).
export async function fetchRecentLoggedSetsForClients(clientIds, sinceDate) {
  if (clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("logged_sets")
    .select("*")
    .in("client_id", clientIds)
    .gte("logged_at", sinceDate)
    .order("logged_at", { ascending: false });
  if (error) throw error;

  const byClient = {};
  clientIds.forEach((id) => (byClient[id] = []));
  data.forEach((row) => byClient[row.client_id].push(row));
  return byClient;
}

// Top weight logged per day for a single exercise, for the history chart.
export async function fetchExerciseHistory(exerciseId) {
  const { data, error } = await supabase.from("logged_sets").select("weight_kg, logged_at").eq("exercise_id", exerciseId);
  if (error) throw error;

  const byDate = new Map();
  data.forEach((row) => {
    const date = row.logged_at.slice(0, 10);
    const w = Number(row.weight_kg) || 0;
    if (!byDate.has(date) || byDate.get(date) < w) byDate.set(date, w);
  });
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, weight]) => ({ date: formatDateLabel(date), weight }));
}

// ---------- mood_checkins: doubles as "workout completed today" marker ----------

export async function fetchMoodCheckins(clientId, sinceDate) {
  const { data, error } = await supabase
    .from("mood_checkins")
    .select("*")
    .eq("client_id", clientId)
    .gte("logged_at", sinceDate)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchMoodCheckinsForClients(clientIds, sinceDate) {
  if (clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("mood_checkins")
    .select("*")
    .in("client_id", clientIds)
    .gte("logged_at", sinceDate)
    .order("logged_at", { ascending: false });
  if (error) throw error;

  const byClient = {};
  clientIds.forEach((id) => (byClient[id] = []));
  data.forEach((row) => byClient[row.client_id].push(row));
  return byClient;
}

export function hasCheckinToday(moodCheckins) {
  const today = todayStr();
  return moodCheckins.some((m) => m.logged_at.slice(0, 10) === today);
}

export async function logMoodCheckin({ clientId, emoji, label }) {
  const { data, error } = await supabase.from("mood_checkins").insert({ client_id: clientId, emoji, label }).select().single();
  if (error) throw error;
  return data;
}
