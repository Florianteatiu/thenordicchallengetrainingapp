// Public connection details for the Supabase project. Both values are safe to
// ship in the browser: every table is protected by row level security.
export const SUPABASE_URL = "https://xydjxnitsjiqptraxkwl.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZGp4bml0c2ppcXB0cmF4a3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NTA2NzAsImV4cCI6MjEwNjEyNjY3MH0.WKDnRl54IV6pA0rWoHofZD-YtwXp244JDE3XXJZu5E4";

export const COACH_FIRST_NAME = "Florian";

// Companion photos of the coach, one per mood, stored in /public/companion.
// Moods without a photo fall back to the coach's profile picture, then to the
// logo. Example: { cheer: "/companion/cheer.jpg" }
export const COMPANION_PHOTOS = {};

// Welcome video shown to new clients on their first sign-in (a YouTube/Vimeo
// link or a video file URL). Empty = the welcome shows a written message.
export const WELCOME_VIDEO_URL = "";

// Public half of the push-notification key pair (safe to ship). Empty =
// notifications are switched off in the app.
export const VAPID_PUBLIC_KEY = "BKw2xOTWwXH5NvrRRNxr2kaKjsT3tf1S2NC70SADanwgXHs8t1qzDhUI1sAsZBVC2uA3DP-goXv8hHoPxQSP4mk";
