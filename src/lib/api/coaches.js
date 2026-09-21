import { supabase } from "../supabaseClient";

export async function fetchCoachById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("coaches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
