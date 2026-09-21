import { supabase } from "../supabaseClient";

export async function fetchThread(clientId) {
  const { data, error } = await supabase.from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// Latest message per client, for the coach's inbox list.
export async function fetchLatestMessagePerClient(clientIds) {
  if (clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latest = {};
  data.forEach((m) => {
    if (!latest[m.client_id]) latest[m.client_id] = m;
  });
  return latest;
}

async function uploadAttachment(clientId, file) {
  const path = `${clientId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("message-attachments").upload(path, file);
  if (error) throw error;
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  return { url: data.signedUrl, type: file.type.startsWith("video") ? "video" : "image" };
}

export async function sendMessage({ clientId, sender, text, attachmentFile }) {
  let attachment_url = null;
  let attachment_type = null;
  if (attachmentFile) {
    const uploaded = await uploadAttachment(clientId, attachmentFile);
    attachment_url = uploaded.url;
    attachment_type = uploaded.type;
  }
  const { data, error } = await supabase
    .from("messages")
    .insert({ client_id: clientId, sender, text: text || null, attachment_url, attachment_type })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToThread(clientId, onInsert) {
  const channel = supabase
    .channel(`messages-${clientId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
