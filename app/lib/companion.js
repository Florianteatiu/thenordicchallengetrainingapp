// What the companion (Florian) says, by situation. Written in the coach's
// voice: direct, warm, a little cheeky, never guilt-tripping. Several lines
// per situation so it doesn't repeat itself every day.
//
// {name} = client's first name, {streak} = current streak, {workout} = title.

const LINES = {
  noProgram: [
    "Welcome to the team, {name}! I'm building your program right now. Hang tight, it'll show up here soon.",
    "Hey {name}, your plan is on my desk. I'll have it ready for you shortly.",
  ],
  workoutToday: [
    "{name}, today is {workout}. Let's get after it!",
    "Your session is ready: {workout}. Show up, do the work, feel great after.",
    "Big day, {name}. {workout} is waiting. I'll be proud of you either way, but prouder if you go.",
    "No need to be perfect today, just be there. {workout}, let's go.",
  ],
  workoutStarted: [
    "You've started {workout}. Finish it strong, {name}!",
    "Halfway there? Let's close this one out.",
  ],
  doneToday: [
    "Done and dusted! That's how it's done, {name}.",
    "Session complete. Eat well, sleep well, and enjoy that feeling.",
    "Another one in the bank. I love seeing this.",
  ],
  restDay: [
    "Rest day, {name}. Recovery is training too. Go for a walk, stretch, sleep well.",
    "No session today. Let the body rebuild, you've earned it.",
    "Rest day. Drink water, move a little, come back hungry tomorrow.",
  ],
  missed: [
    "Missed one? No stress, {name}. Life happens. The next session is the one that counts.",
    "Let's get back on track today. One session and we're rolling again.",
  ],
  streak: [
    "{streak} sessions in a row, {name}! That's real consistency.",
    "{streak} in a row. This is where the magic happens.",
  ],
  finished: [
    "YES {name}! Workout done. Proud of you.",
    "That's the work, {name}. Every session is a step across the country.",
    "Brilliant session. Rest up, you've earned it.",
  ],
  programDone: [
    "You've finished your program, {name}! I'll set up what's next. Amazing work.",
  ],
};

// Mood decides which of the coach's photos the companion shows.
export const MOODS = {
  noProgram: "wave",
  workoutToday: "fired",
  workoutStarted: "fired",
  doneToday: "proud",
  restDay: "relaxed",
  missed: "comeon",
  streak: "cheer",
  finished: "cheer",
  programDone: "proud",
};

// Stable pick for the day, so the message doesn't flicker on each render.
function pick(list, seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function companionLine(situation, vars = {}, seed = new Date().toDateString()) {
  const list = LINES[situation] ?? LINES.workoutToday;
  return pick(list, seed + situation).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
