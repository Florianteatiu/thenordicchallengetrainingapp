import { supabase } from "../supabaseClient";

export async function fetchThread(userId, otherId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// Latest message per client, for the coach's inbox list.
export async function fetchLatestMessagePerClient(coachId, clientIds) {
  if (clientIds.length === 0) return {};
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${coachId},recipient_id.eq.${coachId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latest = {};
  for (const m of data) {
    const clientId = m.sender_id === coachId ? m.recipient_id : m.sender_id;
    if (!clientIds.includes(clientId)) continue;
    if (!latest[clientId]) latest[clientId] = m;
  }
  return latest;
}

async function uploadAttachment(userId, file) {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("message-attachments").upload(path, file);
  if (error) throw error;
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  return { url: data.signedUrl, type: file.type.startsWith("video") ? "video" : "image" };
}

export async function sendMessage({ senderId, recipientId, text, attachmentFile }) {
  let attachment_url = null;
  let attachment_type = null;
  if (attachmentFile) {
    const uploaded = await uploadAttachment(senderId, attachmentFile);
    attachment_url = uploaded.url;
    attachment_type = uploaded.type;
  }
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: senderId, recipient_id: recipientId, body: text || null, attachment_url, attachment_type })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markThreadRead(readerId, otherId) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", readerId)
    .eq("sender_id", otherId)
    .is("read_at", null);
  if (error) throw error;
}

export function subscribeToThread(userId, otherId, onInsert) {
  const channel = supabase
    .channel(`messages-${userId}-${otherId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const m = payload.new;
        const isRelevant =
          (m.sender_id === userId && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === userId);
        if (isRelevant) onInsert(m);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
