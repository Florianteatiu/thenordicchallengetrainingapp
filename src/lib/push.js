import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// PushManager wants the VAPID key as a raw byte array, not the base64url
// string it's normally shared as.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Registers the service worker, asks the browser for notification
// permission, subscribes to push, and stores the subscription so the
// send-push edge function can find it later. `ownerId` is the signed-in
// coach's or client's own id (== auth.uid()), which is what the RLS policy
// on push_subscriptions checks against.
export async function enablePushNotifications(ownerId, ownerRole) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications aren't supported in this browser. On iPhone, add this app to your Home Screen first, then open it from there.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Push notifications aren't configured yet.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission wasn't granted.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      owner_id: ownerId,
      owner_role: ownerRole,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

// Fire-and-forget: the edge function may not be deployed yet, the person
// might not have enabled notifications, or the network call might just
// fail — none of that should ever break the action that triggered it
// (logging a workout, assigning a program).
async function sendPush(ownerId, title, body) {
  try {
    await supabase.functions.invoke("send-push", { body: { ownerId, title, body, url: "/" } });
  } catch (e) {
    console.error("Push notification failed to send", e);
  }
}

export function notifyCoach(coachId, title, body) {
  return sendPush(coachId, title, body);
}

export function notifyClient(clientId, title, body) {
  return sendPush(clientId, title, body);
}
