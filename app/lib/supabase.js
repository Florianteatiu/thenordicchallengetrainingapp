import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

// Local development (npm run dev) can point at a local Supabase via
// .env.local; production builds always use config.js.
const url = (import.meta.env.DEV && import.meta.env.VITE_DEV_SUPABASE_URL) || SUPABASE_URL;
const key = (import.meta.env.DEV && import.meta.env.VITE_DEV_SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// Gym Wi-Fi, mobile data and VPNs drop replies ("TypeError: Load failed").
// Requests that are safe to send twice are retried a few times before the
// error reaches the screen: reads, updates, deletes and upserts. Plain
// inserts and RPCs are not (sending them twice could create duplicates).
const RETRY_DELAYS = [700, 1500, 3000];

function isRepeatable(input, init = {}) {
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (["GET", "HEAD", "PATCH", "DELETE"].includes(method)) return true;
  if (method !== "POST") return false;
  const href = typeof input === "string" ? input : input.url;
  if (href.includes("/rest/v1/rpc/") || href.includes("/auth/v1/") || href.includes("/storage/v1/")) return false;
  const prefer = new Headers(init.headers || (input instanceof Request ? input.headers : undefined)).get("Prefer") || "";
  return prefer.includes("resolution=merge-duplicates"); // upsert
}

async function fetchWithRetry(input, init) {
  const repeatable = isRepeatable(input, init);
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      // Only network failures land here (HTTP errors come back as responses).
      if (!repeatable || attempt >= RETRY_DELAYS.length || init?.signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
}

export const supabase = isConfigured ? createClient(url, key, { global: { fetch: fetchWithRetry } }) : null;
