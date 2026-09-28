// Sends push notifications for things that happen in the app.
//
// The app calls this right after an action, with { type, id }:
//   message        a chat message was sent            -> the other side
//   workout        a client finished a workout        -> the coach
//   checkin        a client submitted a check-in      -> the coach
//   checkin_reply  the coach replied to a check-in    -> the client
//   program        the coach activated a program      -> the client
// The function looks the row up itself and checks that the caller is the one
// who did it, so nobody can make it send arbitrary text to arbitrary people.
//
//   { type: "daily" } (no sign-in needed) sends each client with a workout
//   scheduled today one morning reminder; reminder_log makes repeat calls
//   harmless. A daily cron job calls it (see README).
//
// Needs the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
  auth: { persistSession: false },
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:florianteatiu@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "Someone";
const clip = (text: string, n = 120) => (text.length > n ? text.slice(0, n - 1) + "…" : text);

async function profile(id: string) {
  const { data } = await admin.from("profiles").select("id, role, full_name").eq("id", id).maybeSingle();
  return data;
}

async function coach() {
  const { data } = await admin.from("profiles").select("id, full_name").eq("role", "coach").maybeSingle();
  return data;
}

async function push(userId: string, payload: { title: string; body: string; url: string; tag?: string }) {
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
        sent++;
      } catch (err) {
        // The browser dropped this subscription: forget it.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
  return sent;
}

// Today's date in Sweden, as YYYY-MM-DD.
function stockholmToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm" }).format(new Date());
}

function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function dailyReminders() {
  const today = stockholmToday();
  const { data: programs } = await admin
    .from("programs")
    .select("client_id, start_date, program_days(id, week, day, workout:workouts(title))")
    .eq("status", "active")
    .not("start_date", "is", null);

  let sent = 0;
  for (const p of programs ?? []) {
    const monday = mondayOf(p.start_date);
    const todays = (p.program_days ?? []).filter((d: { week: number; day: number }) => {
      const date = new Date(monday + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + (d.week - 1) * 7 + (d.day - 1));
      return date.toISOString().slice(0, 10) === today;
    });
    if (!todays.length) continue;

    const { data: done } = await admin
      .from("workout_sessions")
      .select("id")
      .eq("client_id", p.client_id)
      .in("program_day_id", todays.map((d: { id: string }) => d.id))
      .not("completed_at", "is", null);
    if ((done ?? []).length >= todays.length) continue;

    // Claim today's reminder; if it's already there, this client got one.
    const { error } = await admin.from("reminder_log").insert({ client_id: p.client_id, day: today });
    if (error) continue;

    const client = await profile(p.client_id);
    const title = todays[0].workout?.title ?? "your session";
    sent += await push(p.client_id, {
      title: `Today: ${title}`,
      body: `Morning ${firstName(client?.full_name)}! Your session is ready when you are.`,
      url: "/app",
      tag: "daily",
    });
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ skipped: "push not configured" });

  try {
    const { type, id } = await req.json();
    if (type === "daily") return json({ sent: await dailyReminders() });

    // Everything else must come from the signed-in person who did it.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    const caller = auth?.user?.id;
    if (!caller || !id) return json({ error: "not signed in" }, 401);

    if (type === "message") {
      const { data: m } = await admin.from("messages").select("*").eq("id", id).maybeSingle();
      if (!m || m.sender_id !== caller) return json({ error: "not yours" }, 403);
      const sender = await profile(m.sender_id);
      const text = m.body ? clip(m.body) : "🎤 Voice note";
      if (sender?.role === "coach") {
        return json({ sent: await push(m.client_id, { title: firstName(sender.full_name), body: text, url: "/app/chat", tag: "chat" }) });
      }
      const c = await coach();
      if (!c) return json({ sent: 0 });
      return json({
        sent: await push(c.id, { title: sender?.full_name || "New message", body: text, url: `/coach/inbox/${m.client_id}`, tag: `chat-${m.client_id}` }),
      });
    }

    if (type === "workout") {
      const { data: s } = await admin.from("workout_sessions").select("*").eq("id", id).maybeSingle();
      if (!s || s.client_id !== caller || !s.completed_at) return json({ error: "not yours" }, 403);
      const [client, c] = await Promise.all([profile(s.client_id), coach()]);
      if (!c) return json({ sent: 0 });
      const feel = ["😫", "😕", "😐", "🙂", "🤩"][(s.feeling ?? 0) - 1] ?? "";
      const parts = [s.rpe ? `RPE ${s.rpe}` : "", feel, s.notes ? `“${clip(s.notes, 80)}”` : ""].filter(Boolean);
      return json({
        sent: await push(c.id, {
          title: `${firstName(client?.full_name)} finished ${s.workout_title || "a workout"}`,
          body: parts.join(" · ") || "Workout complete.",
          url: `/coach/clients/${s.client_id}`,
        }),
      });
    }

    if (type === "checkin") {
      const { data: ci } = await admin.from("checkins").select("*").eq("id", id).maybeSingle();
      if (!ci || ci.client_id !== caller) return json({ error: "not yours" }, 403);
      const [client, c] = await Promise.all([profile(ci.client_id), coach()]);
      if (!c) return json({ sent: 0 });
      return json({
        sent: await push(c.id, {
          title: `${firstName(client?.full_name)} sent their weekly check-in`,
          body: ci.wins ? clip(ci.wins) : "Tap to read and reply.",
          url: `/coach/inbox/${ci.client_id}?tab=checkins`,
        }),
      });
    }

    if (type === "checkin_reply") {
      const me = await profile(caller);
      if (me?.role !== "coach") return json({ error: "coach only" }, 403);
      const { data: ci } = await admin.from("checkins").select("*").eq("id", id).maybeSingle();
      if (!ci?.coach_reply) return json({ sent: 0 });
      return json({
        sent: await push(ci.client_id, { title: `${firstName(me.full_name)} replied to your check-in`, body: clip(ci.coach_reply), url: "/app/checkin" }),
      });
    }

    if (type === "program") {
      const me = await profile(caller);
      if (me?.role !== "coach") return json({ error: "coach only" }, 403);
      const { data: p } = await admin.from("programs").select("client_id, title, status").eq("id", id).maybeSingle();
      if (!p?.client_id || p.status !== "active") return json({ sent: 0 });
      return json({
        sent: await push(p.client_id, { title: "Your new program is ready", body: `${p.title} is waiting for you. Let's go!`, url: "/app/plan" }),
      });
    }

    return json({ error: "unknown type" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
