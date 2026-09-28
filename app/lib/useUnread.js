import { useEffect, useState } from "react";
import { countUnread, listConversations, subscribeToMessages } from "./api";

// Unread messages from the coach, for a client's Chat tab badge.
export function useClientUnread(clientId, myId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => countUnread(clientId, myId).then((n) => alive && setCount(n)).catch(() => {});
    refresh();
    const unsubscribe = subscribeToMessages(clientId, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [clientId, myId]);
  return count;
}

// Conversations (latest message + unread count per client) for the coach,
// kept live.
export function useConversations() {
  const [conversations, setConversations] = useState({});
  useEffect(() => {
    let alive = true;
    const refresh = () => listConversations().then((c) => alive && setConversations(c)).catch(() => {});
    refresh();
    const unsubscribe = subscribeToMessages(null, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return conversations;
}
