import { supabase } from "../supabaseClient";

export async function fetchClientsForCoach(coachId) {
  const { data, error } = await supabase.from("clients").select("*").eq("coach_id", coachId).order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchClientById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateClient(id, patch) {
  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

function extensionFor(file) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop() : "jpg";
}

export async function uploadAvatar(clientId, file) {
  const path = `${clientId}/avatar.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  await updateClient(clientId, { photo_url: url });
  return url;
}
