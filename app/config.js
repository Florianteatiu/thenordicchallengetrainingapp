// Public connection details for the Supabase project. Both values are safe to
// ship in the browser: every table is protected by row level security.
// Filled in once the new Supabase project exists.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const COACH_FIRST_NAME = "Florian";

// Companion photos of the coach, one per mood, stored in /public/companion.
// Moods without a photo fall back to the coach's profile picture, then to the
// logo. Example: { cheer: "/companion/cheer.jpg" }
export const COMPANION_PHOTOS = {};
