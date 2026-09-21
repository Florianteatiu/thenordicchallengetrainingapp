import { supabase } from "../supabaseClient";

export async function fetchClientsForCoach(coachId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("coach_id", coachId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchProfileById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function touchLastActive(id) {
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", id);
}

function extensionFor(file) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop() : "jpg";
}

export async function uploadAvatar(userId, file) {
  const path = `${userId}/avatar.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  await updateProfile(userId, { avatar_url: url });
  return url;
}

export function initialsFor(name) {
  return (name || "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
