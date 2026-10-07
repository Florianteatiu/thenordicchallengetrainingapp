import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Logged sets are written through this queue so a gym with bad signal never
// loses them. Each set has one key; a newer write replaces an older one that
// hasn't gone out yet. Failed writes stay queued (also across app restarts,
// via localStorage) and are retried until the network is back. Only a real
// database refusal (it has an error code) is dropped and reported.
//
// Job: { key, table, op: "upsert" | "delete", row?, match?, onConflict? }

const STORE = "tnc-save-queue";
const RETRY_MS = 3000;

let jobs = load();
const callbacks = new Map(); // key -> { onSaved, onError } (this page load only)
const listeners = new Set();
let running = false;
let timer = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? [];
  } catch {
    return [];
  }
}

function changed() {
  try {
    localStorage.setItem(STORE, JSON.stringify(jobs));
  } catch {
    // storage unavailable (private mode): the queue still works in memory
  }
  listeners.forEach((l) => l(jobs.length));
}

async function run(job) {
  const q = supabase.from(job.table);
  if (job.op === "delete") return q.delete().match(job.match);
  return q.upsert(job.row, { onConflict: job.onConflict }).select().single();
}

// No error code = it never reached the database (offline, "Load failed").
const isNetwork = (error) => !error.code;

async function flush() {
  if (running) return;
  running = true;
  clearTimeout(timer);
  try {
    while (jobs.length) {
      const job = jobs[0];
      let result;
      try {
        result = await run(job);
      } catch (e) {
        result = { error: { message: String(e) } };
      }
      const cb = callbacks.get(job.key);
      if (result.error && isNetwork(result.error)) {
        timer = setTimeout(flush, RETRY_MS);
        return;
      }
      // Done (or refused): drop it, unless a newer write replaced it meanwhile.
      if (jobs[0] === job) {
        jobs = jobs.slice(1);
        if (cb?.job === job) callbacks.delete(job.key);
        changed();
      }
      if (cb?.job === job) {
        if (result.error) cb.onError?.(result.error);
        else cb.onSaved?.(result.data);
      }
    }
  } finally {
    running = false;
  }
}

export function enqueueSave(job, { onSaved, onError } = {}) {
  const i = jobs.findIndex((j) => j.key === job.key);
  // Don't replace the job that's in flight; queue behind it instead.
  if (i > 0 || (i === 0 && !running)) jobs = jobs.filter((_, k) => k !== i);
  jobs = [...jobs, job];
  callbacks.set(job.key, { job, onSaved, onError });
  changed();
  flush();
}

// Number of writes still waiting, for a "Saving…" note.
export function usePendingSaves() {
  const [count, setCount] = useState(jobs.length);
  useEffect(() => {
    listeners.add(setCount);
    setCount(jobs.length);
    return () => listeners.delete(setCount);
  }, []);
  return count;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flush);
  window.addEventListener("beforeunload", (e) => {
    if (jobs.length) e.preventDefault();
  });
  if (jobs.length) setTimeout(flush, 1000); // left over from last time
}

// Set logs (set_logs / pt_set_logs): one queue slot per set, so ticking,
// editing and un-ticking the same set while offline ends in the last state.
const SET_CONFLICT = "session_id,block_exercise_id,set_number";
const setKey = (table, s, b, n) => `${table}:${s}:${b}:${n}`;

export function queueSetLog(table, row, callbacks) {
  // eslint-disable-next-line no-unused-vars
  const { id, created_at, ...clean } = row;
  enqueueSave({ key: setKey(table, row.session_id, row.block_exercise_id, row.set_number), table, op: "upsert", row: clean, onConflict: SET_CONFLICT }, callbacks);
}

export function queueSetLogDelete(table, sessionId, blockExerciseId, setNumber, callbacks) {
  enqueueSave(
    { key: setKey(table, sessionId, blockExerciseId, setNumber), table, op: "delete", match: { session_id: sessionId, block_exercise_id: blockExerciseId, set_number: setNumber } },
    callbacks,
  );
}
