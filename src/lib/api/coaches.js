import { supabase } from "../supabaseClient";

export async function fetchCoachById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("coaches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCoach(id, patch) {
  const { data, error } = await supabase.from("coaches").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
