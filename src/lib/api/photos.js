import { supabase } from "../supabaseClient";

export async function fetchProgressPhotos(clientId) {
  const { data, error } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("client_id", clientId)
    .order("taken_at", { ascending: true });
  if (error) throw error;

  return Promise.all(
    data.map(async (p) => {
      const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrl(p.url, 60 * 60 * 24);
      return { ...p, signedUrl: signed?.signedUrl };
    })
  );
}

export async function uploadProgressPhoto(clientId, file) {
  const path = `${clientId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.from("progress_photos").insert({ client_id: clientId, url: path }).select().single();
  if (error) throw error;

  const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrl(path, 60 * 60 * 24);
  return { ...data, signedUrl: signed?.signedUrl };
}
