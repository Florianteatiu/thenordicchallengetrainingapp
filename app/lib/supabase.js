import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

// Local development (npm run dev) can point at a local Supabase via
// .env.local; production builds always use config.js.
const url = (import.meta.env.DEV && import.meta.env.VITE_DEV_SUPABASE_URL) || SUPABASE_URL;
const key = (import.meta.env.DEV && import.meta.env.VITE_DEV_SUPABASE_ANON_KEY) || SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = isConfigured ? createClient(url, key) : null;
