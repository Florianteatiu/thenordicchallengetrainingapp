import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Play, Plus, Share2, Timer, Trophy, Video } from "lucide-react";
import { drawSummaryCard, shareImage } from "../lib/shareCard";
import { useAuth } from "../auth/AuthProvider";
import {
  completeSession,
  getActiveProgramFor,
  findSession,
  getCoachProfile,
  getLastPerformance,
  getOrCreateSession,
  getProgramDay,
  getSessionLogs,
  getWorkout,
  listSessions,
  upsertBlockLog,
} from "../lib/api";
import { formatDateTime, programDayDate, todayISO } from "../lib/dates";
import { blockSummary, estimateWorkoutSec, exerciseMeta, firstName, formatClock, formatDistance, formatEstimate, formatLabel, isSetBased, numOrNull, parseDuration, prescription, setItemProps } from "../lib/format";
import { POINTS, XP_PER_WORKOUT, levelFor, sessionsByDay, totalXp, workoutStreak } from "../lib/gamify";
import { companionLine, MOODS } from "../lib/companion";
import { go, unlockAudio, vibrate } from "../lib/sound";
import Companion from "../components/Companion";
import { ErrorBox, Modal, PageLoader, ProgressBar, useAsync } from "../components/ui";
import { FEELINGS } from "../components/SessionDetail";
import BlockTimer from "./BlockTimer";
import { queueSetLog, queueSetLogDelete } from "../lib/saveQueue";
import SavingNote from "../components/SavingNote";
import { VideoModal } from "../components/VideoEmbed";

// Opens the exercise's demo video (the coach's own clip) right in the app.
export function VideoButton({ exercise, size = 18 }) {
  const [open, setOpen] = useState(false);
  if (!exercise?.video_url) return null;
  return (
    <>
      <button className="icon-btn video-btn" onClick={() => setOpen(true)} aria-label="Watch demo">
        <Video size={size} />
      </button>
      {open && <VideoModal title={exercise.name} url={exercise.video_url} cues={exercise.cues} onClose={() => setOpen(false)} />}
    </>
  );
}

const NIL = "00000000-0000-0000-0000-000000000000";
const firstNumber = (text) => {
  const m = String(text ?? "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// ---------- One set row ----------

// Distance is typed in metres ("250"); a "k"/"km" suffix means kilometres ("5k").
function parseDistance(text) {
  const t = String(text ?? "").trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(/k/.test(t) ? n * 1000 : n);
}

// Phone number pads have no ":", so plain digits read like a clock:
// "30" = 0:30, "130" = 1:30, "0030" = 0:30. With a colon it's as typed.
function parseClockTyped(text) {
  const t = String(text ?? "").trim();
  if (!/^\d{3,}$/.test(t)) return parseDuration(t);
  return Number(t.slice(0, -2)) * 60 + Number(t.slice(-2));
}

// Cardio (time and distance + time) is logged as work + rest per set, so a
// Tabata is 8 sets of 0:20 work / 0:10 rest.
const hasRest = (tracking) => tracking === "time" || tracking === "distance_time";

// A logged row with done = false is a "draft": numbers typed (or planned)
// but not ticked yet. They're saved so nothing typed is ever lost.
const isDone = (row) => Boolean(row) && row.done !== false;
// A new key whenever the row should re-read its numbers (ticked, or a saved
// draft that arrives with the page), but the same key while a draft typed
// here is being saved, so saving never steals focus from the next box.
const rowKey = (n, row) => {
  if (isDone(row)) return `${n}-${row.id}`;
  return row?.id && row.id !== "draft" ? `${n}-open-${row.id}` : `${n}-open`;
};

function SetRow({ n, tag, tracking, logged, defaults, onToggle, onUpdate, onDraft }) {
  const init = (v) => (v == null ? "" : String(v));
  const clock = (v) => (v == null ? "" : formatClock(v));
  const [load, setLoad] = useState(init(logged?.load_kg));
  const [reps, setReps] = useState(init(logged?.reps));
  const [time, setTime] = useState(clock(logged?.duration_sec));
  const [rest, setRestText] = useState(clock(logged?.rest_sec));
  const [dist, setDist] = useState(init(logged?.distance_m));
  const done = isDone(logged);

  const values = () => ({
    load_kg: tracking === "weight_reps" || tracking === "weight_time" ? numOrNull(load) ?? defaults.load : null,
    reps: tracking === "weight_reps" || tracking === "reps" ? numOrNull(reps) ?? defaults.reps : null,
    duration_sec: tracking === "time" || tracking === "distance_time" || tracking === "weight_time" ? parseClockTyped(time) ?? defaults.duration : null,
    distance_m: tracking === "distance_time" ? parseDistance(dist) ?? defaults.distance : null,
    ...(hasRest(tracking) ? { rest_sec: parseClockTyped(rest) ?? defaults.rest } : {}),
  });

  const typed = () => [load, reps, time, rest, dist].some((v) => String(v).trim() !== "");
  const blur = () => (done ? onUpdate(values()) : onDraft && typed() && onDraft(values()));
  const ph = (v) => (v == null ? "–" : String(v));
  // Show what was typed as a clock (30 -> 0:30) once the box is left.
  const timeInput = (value, set, def, fallback) => (
    <input
      className="input"
      inputMode="numeric"
      placeholder={def ? formatClock(def) : fallback}
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={() => {
        const sec = parseClockTyped(value);
        if (sec != null) set(formatClock(sec));
        blur();
      }}
    />
  );

  return (
    <div className={`set-row${COLS[HEADS[tracking].length]}${done ? " done" : ""}`}>
      <div className="set-num">{tag ?? n}</div>
      {tracking === "weight_reps" && (
        <>
          <input className="input" inputMode="decimal" placeholder={ph(defaults.load)} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={blur} />
          <input className="input" inputMode="numeric" placeholder={ph(defaults.reps)} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={blur} />
        </>
      )}
      {tracking === "weight_time" && (
        <>
          <input className="input" inputMode="decimal" placeholder={ph(defaults.load)} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={blur} />
          {timeInput(time, setTime, defaults.duration, "–")}
        </>
      )}
      {tracking === "reps" && <input className="input" inputMode="numeric" placeholder={ph(defaults.reps)} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={blur} />}
      {tracking === "distance_time" && (
        <input className="input" inputMode="decimal" placeholder={defaults.distance ? String(defaults.distance) : "m"} value={dist} onChange={(e) => setDist(e.target.value)} onBlur={blur} />
      )}
      {hasRest(tracking) && (
        <>
          {timeInput(time, setTime, defaults.duration, "–")}
          {timeInput(rest, setRestText, defaults.rest, formatClock(DEFAULT_REST))}
        </>
      )}
      <button className={`check${done ? " on" : ""}`} onClick={() => onToggle(values())} aria-label={done ? "Undo set" : "Complete set"}>
        <Check size={20} strokeWidth={3} />
      </button>
    </div>
  );
}

const HEADS = {
  weight_reps: ["kg", "reps"],
  weight_time: ["kg", "time"],
  reps: ["reps"],
  time: ["work", "rest"],
  distance_time: ["metres", "work", "rest"],
};
const COLS = { 1: " one", 2: "", 3: " three" };

// ---------- Set grid (shared by the client player and Nordic PT) ----------

export { isDone };

export function lastTimeText(last) {
  return last.sets
    .map((s) =>
      [
        s.load_kg != null && `${+s.load_kg}kg`,
        s.reps != null && `${s.reps}`,
        s.distance_m != null && formatDistance(s.distance_m),
        s.duration_sec != null && (s.rest_sec ? `${formatClock(s.duration_sec)} on/${formatClock(s.rest_sec)} off` : formatClock(s.duration_sec)),
      ]
        .filter(Boolean)
        .join("×"),
    )
    .join(", ");
}

// The header row + one row per set + "Add set" for one exercise and one
// person. `sets` = { setNumber -> logged row }.
// What to pre-fill for set/round `n`: last time's numbers, else the plan.
function setDefaults(item, last, n) {
  const prev = last?.sets.find((s) => s.set_number === n) ?? last?.sets[last.sets.length - 1];
  return {
    load: prev?.load_kg != null ? +prev.load_kg : /kg|^\s*\d/.test(item.load ?? "") ? firstNumber(item.load) : null,
    reps: firstNumber(item.reps) ?? prev?.reps ?? null,
    duration: item.duration_sec ?? prev?.duration_sec ?? null,
    distance: item.distance_m ?? prev?.distance_m ?? null,
    rest: item.rest_sec ?? prev?.rest_sec ?? null,
  };
}

export function SetsGrid({ item, sets, last, extra, onAddSet, onToggle, onUpdate, onDraft, restSec }) {
  const tracking = item.exercise?.tracking ?? "weight_reps";
  const count = Math.max(item.sets || 1, ...Object.keys(sets).map(Number)) + extra;
  const defaultsFor = (n) => setDefaults(item, last, n);

  return (
    <>
      <div className="set-grid">
        <div className={`set-row${COLS[HEADS[tracking].length]}`}>
          <div className="set-head">Set</div>
          {HEADS[tracking].map((h) => (
            <div key={h} className="set-head">
              {h}
            </div>
          ))}
          <div />
        </div>
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <SetRow
            key={rowKey(n, sets[n])}
            n={n}
            tracking={tracking}
            logged={sets[n]}
            defaults={defaultsFor(n)}
            onToggle={(v) => onToggle(item, n, v, restSec)}
            onUpdate={(v) => onUpdate(item, n, v)}
            onDraft={onDraft && ((v) => onDraft(item, n, v))}
          />
        ))}
      </div>
      <button className="link-btn small mt-8 row gap-4" onClick={onAddSet}>
        <Plus size={14} /> Add set
      </button>
    </>
  );
}

// Name, prescription, coach note, video and cues for one exercise.
export function ExerciseHeader({ item, label, restSec, nextLabel, badge }) {
  const [showCues, setShowCues] = useState(false);
  const ex = item.exercise ?? {};
  const tracking = ex.tracking ?? "weight_reps";
  return (
    <>
      <div className="row between">
        <div className="grow">
          <div className="row gap-6 wrap">
            {label && <span className="letter" style={{ width: "auto", minWidth: 28, padding: "0 6px", height: 24, fontSize: 13 }}>{label}</span>}
            <span className="h3">{ex.name}</span>
            {badge}
          </div>
          {exerciseMeta(ex) && <div className="tiny muted mt-4">{exerciseMeta(ex)}</div>}
          <div className="small yellow mt-4">{prescription(restSec === undefined ? item : { ...item, rest_sec: restSec }, "sets", tracking)}</div>
          {nextLabel && <div className="tiny muted mt-4">Then straight into {nextLabel}, no rest</div>}
        </div>
        <div className="row gap-4">
          <VideoButton exercise={ex} />
          {ex.cues && (
            <button className="icon-btn" onClick={() => setShowCues((s) => !s)} aria-label="Technique cues">
              {showCues ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
        </div>
      </div>
      {item.notes && <div className="small mt-8" style={{ borderLeft: "3px solid var(--yellow)", paddingLeft: 8 }}>{item.notes}</div>}
      {showCues && <div className="small muted mt-8">{ex.cues}</div>}
    </>
  );
}

// ---------- Superset, laid out round by round ----------

// One set of each exercise back to back, then rest = one round. Each round's
// rows are the same set_number for every exercise, so logs, "last time" and
// PRs work exactly like straight sets.
export function SupersetRounds({ block, letter, sets, last, prs, extraRounds = 0, onAddRound, onToggle, onUpdate, onDraft }) {
  const items = block.items;
  const rest = Math.max(0, ...items.map((i) => i.rest_sec || 0));
  const logged = items.flatMap((it) => Object.keys(sets[it.id] ?? {}).map(Number));
  const rounds = Math.max(1, ...items.map((i) => i.sets || 1), ...logged) + extraRounds;
  const label = (i) => `${letter}${i + 1}`;

  return (
    <>
      {items.map((item, i) => {
        const l = last[item.exercise_id];
        return (
          <div key={item.id} className="exercise">
            <ExerciseHeader
              item={{ ...item, sets: null }}
              label={label(i)}
              restSec={0}
              badge={
                prs.has(item.exercise_id) && (
                  <span className="pill pill-yellow">
                    <Trophy size={11} /> New PR!
                  </span>
                )
              }
            />
            {l && <div className="tiny faint mt-8">Last time: {lastTimeText(l)}</div>}
          </div>
        );
      })}
      <div className="exercise">
        <div className="small muted mb-8">
          One set of each exercise back to back{rest ? `, then rest ${formatClock(rest)}` : ", then rest"}. That's one round.
        </div>
        {Array.from({ length: rounds }, (_, r) => r + 1).map((n) => (
          <div key={n} className="round">
            <div className="round-title">Round {n}</div>
            {items.map((item, i) => {
              const tracking = item.exercise?.tracking ?? "weight_reps";
              const isLast = i === items.length - 1;
              return (
                <div key={item.id} className="round-row">
                  <div className="tiny muted ellipsis">
                    <b className="yellow">{label(i)}</b> {item.exercise?.name} · {HEADS[tracking].join(" / ")}
                  </div>
                  <SetRow
                    key={rowKey(n, sets[item.id]?.[n])}
                    n={n}
                    tag={label(i)}
                    tracking={tracking}
                    logged={sets[item.id]?.[n]}
                    defaults={setDefaults(item, last[item.exercise_id], n)}
                    onToggle={(v) => onToggle(item, n, v, isLast ? rest || null : 0)}
                    onUpdate={(v) => onUpdate(item, n, v)}
                    onDraft={onDraft && ((v) => onDraft(item, n, v))}
                  />
                  {isLast && rest > 0 && <div className="tiny faint round-rest">Rest {formatClock(rest)}</div>}
                </div>
              );
            })}
          </div>
        ))}
        <button className="link-btn small mt-8 row gap-4" onClick={onAddRound}>
          <Plus size={14} /> Add round
        </button>
      </div>
    </>
  );
}

// ---------- Exercise within a straight-sets block ----------

// `label`/`restSec`/`nextLabel` come from setItemProps() for supersets.
export function ExerciseSets({ item, sets, last, isPR, extra, onAddSet, onToggle, onUpdate, onDraft, label, restSec, nextLabel }) {
  return (
    <div className="exercise">
      <ExerciseHeader
        item={item}
        label={label}
        restSec={restSec}
        nextLabel={nextLabel}
        badge={
          isPR && (
            <span className="pill pill-yellow">
              <Trophy size={11} /> New PR!
            </span>
          )
        }
      />
      {last && <div className="tiny faint mt-8">Last time: {lastTimeText(last)}</div>}
      <SetsGrid item={item} sets={sets} last={last} extra={extra} onAddSet={onAddSet} onToggle={onToggle} onUpdate={onUpdate} onDraft={onDraft} restSec={restSec} />
    </div>
  );
}

// ---------- Result form for a timed block ----------

export function BlockResult({ block, logged, prefill, onSave }) {
  const [rounds, setRounds] = useState(logged?.rounds ?? prefill?.rounds ?? "");
  const [extra, setExtra] = useState(logged?.extra_reps ?? "");
  const [time, setTime] = useState(logged?.duration_sec != null ? formatClock(logged.duration_sec) : prefill?.duration_sec ? formatClock(prefill.duration_sec) : "");
  const [notes, setNotes] = useState(logged?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.rounds != null) setRounds(prefill.rounds);
    if (prefill.duration_sec) setTime(formatClock(prefill.duration_sec));
  }, [prefill]);

  async function save() {
    setBusy(true);
    await onSave({ rounds: numOrNull(rounds), extra_reps: numOrNull(extra), duration_sec: parseDuration(time), notes: notes.trim() || null });
    setBusy(false);
  }

  return (
    <div className="col gap-6">
      <div className="grid-2">
        <label className="field">
          <span>Rounds done</span>
          <input className="input input-sm" inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value)} placeholder={block.rounds ? String(block.rounds) : "0"} />
        </label>
        {block.format === "amrap" ? (
          <label className="field">
            <span>+ extra reps</span>
            <input className="input input-sm" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0" />
          </label>
        ) : (
          <label className="field">
            <span>Time</span>
            <input className="input input-sm" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="mm:ss" />
          </label>
        )}
      </div>
      <input className="input input-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go? (optional)" />
      <button className={`btn btn-sm ${logged ? "btn-ghost" : "btn-primary"}`} onClick={save} disabled={busy}>
        {logged ? <><Check size={14} /> Saved · update</> : "Save result"}
      </button>
    </div>
  );
}

// ---------- Rest timer bar ----------

// What to count down after a set is ticked: timed exercises first count the
// work (left side, then right for one-sided ones), then rest. Rest = what's
// typed on the set, else the plan, else DEFAULT_REST. restSec 0 means "no
// rest" (straight into the next superset exercise).
const DEFAULT_REST = 60;
const SWITCH_SIDES_SEC = 5;
const TIMED = new Set(["time", "weight_time", "distance_time"]);

const startStep = (steps) => (steps.length ? { steps, endsAt: Date.now() + steps[0].sec * 1000 } : null);

export function timerAfterSet(item, values, restSec) {
  const rest = values.rest_sec ?? (restSec === 0 ? 0 : restSec || DEFAULT_REST);
  const ex = item.exercise ?? {};
  const work = TIMED.has(ex.tracking) && values.duration_sec && values.duration_sec <= 600 ? values.duration_sec : 0;
  const steps = [];
  if (work && ex.unilateral) {
    steps.push({ kind: "work", label: "LEFT SIDE", sec: work }, { kind: "switch", label: "SWITCH SIDES", sec: SWITCH_SIDES_SEC }, { kind: "work", label: "RIGHT SIDE", sec: work });
  } else if (work) {
    steps.push({ kind: "work", label: "WORK", sec: work });
  }
  if (rest) steps.push({ kind: "rest", label: "REST", sec: rest });
  return startStep(steps);
}

// Move on to the next step (or close the bar after the last one).
export const nextTimer = (t) => (t ? startStep(t.steps.slice(1)) : null);

export function RestBar({ rest, onDone, onAdd }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest.endsAt]);
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const step = rest.steps[0];
  const last = rest.steps.length === 1;
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      go();
      vibrate();
      const t = setTimeout(onDone, last ? 1200 : 300);
      return () => clearTimeout(t);
    }
  }, [left, onDone, last]);

  return (
    <div className={`rest-bar ${step.kind}`}>
      <div className="rest-bar-inner">
        <Timer size={20} />
        <div className="grow">
          <div className="tiny" style={{ fontWeight: 700, opacity: 0.7 }}>{left > 0 ? step.label : last ? (step.kind === "rest" ? "GO!" : "DONE!") : rest.steps[1].label}</div>
          <div className="display" style={{ fontSize: 30 }}>{formatClock(Math.ceil(left))}</div>
        </div>
        <button className="btn btn-sm btn-dark" onClick={onAdd}>+15s</button>
        <button className="btn btn-sm btn-dark" onClick={onDone}>Skip</button>
      </div>
    </div>
  );
}

// ---------- Shareable summary card ----------

function ShareCardModal({ card, onClose }) {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let objectUrl;
    drawSummaryCard(card)
      .then((b) => {
        setBlob(b);
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => setStatus("Couldn't create the image on this phone."));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [card]);

  return (
    <Modal title="Share your workout" onClose={onClose}>
      <div className="col gap-12" style={{ alignItems: "center" }}>
        {url ? <img src={url} alt="Workout summary" className="share-preview" /> : <div className="share-preview placeholder" />}
        {status && <div className="small muted">{status}</div>}
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={!blob}
          onClick={async () => {
            const r = await shareImage(blob);
            if (r === "downloaded") setStatus("Saved to your downloads. Post it to your story!");
          }}
        >
          <Share2 size={18} /> Share to Instagram & more
        </button>
        <div className="tiny faint">Tip: pick Instagram → Stories and tag @florianteatiu</div>
      </div>
    </Modal>
  );
}

// ---------- Celebration ----------

function Celebration({ coach, name, stats, onClose }) {
  const [sharing, setSharing] = useState(false);
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.8,
        color: ["#FFE234", "#FFFFFF", "#4BC98A", "#FFE234"][i % 4],
      })),
    [],
  );
  return (
    <div className="celebrate">
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
      ))}
      <Companion large mood={MOODS.finished} coachAvatar={coach?.avatar_url}>
        {companionLine("finished", { name })}
      </Companion>
      <div className="xp mt-24">+{XP_PER_WORKOUT} {POINTS}</div>
      <div className="row gap-16 mt-12 muted">
        {stats.streak > 0 && <span>🔥 {stats.streak} in a row</span>}
        {stats.prs > 0 && <span>🏆 {stats.prs} new PR{stats.prs > 1 ? "s" : ""}</span>}
      </div>
      {stats.level && (
        <div style={{ width: "100%", maxWidth: 320 }} className="mt-24">
          <div className="row between small mb-8">
            <span style={{ fontWeight: 700 }}>{stats.leveledUp ? `Level up! ${stats.level.name}` : stats.level.name}</span>
            <span className="faint">{stats.level.xp} {POINTS}</span>
          </div>
          <ProgressBar value={stats.level.progress} />
          {stats.leveledUp && stats.level.meaning && <div className="small muted mt-8 center">{stats.level.meaning}</div>}
        </div>
      )}
      {stats.card && (
        <button className="btn btn-lg mt-24" style={{ minWidth: 220 }} onClick={() => setSharing(true)}>
          <Share2 size={18} /> Share my workout
        </button>
      )}
      <button className="btn btn-primary btn-lg mt-12" style={{ minWidth: 220 }} onClick={onClose}>
        Back to today
      </button>
      {sharing && <ShareCardModal card={stats.card} onClose={() => setSharing(false)} />}
    </div>
  );
}

// ---------- Finish modal ----------

function FinishModal({ onClose, onSubmit }) {
  const [feeling, setFeeling] = useState(4);
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Finish workout" onClose={onClose}>
      <div className="col gap-16">
        <div>
          <div className="eyebrow mb-8">How do you feel?</div>
          <div className="feel-row">
            {FEELINGS.map((f, i) => (
              <button key={f} className={`feel${feeling === i + 1 ? " active" : ""}`} onClick={() => setFeeling(i + 1)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="row between">
            <div className="eyebrow">How hard was it?</div>
            <div className="display yellow" style={{ fontSize: 24 }}>{rpe}/10</div>
          </div>
          <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--yellow)" }} />
          <div className="row between tiny faint">
            <span>Easy</span>
            <span>All out</span>
          </div>
        </div>
        <label className="field">
          <span>Note for your coach (optional)</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything felt off? Anything felt amazing?" />
        </label>
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSubmit({ feeling, rpe, notes });
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Complete workout"}
        </button>
      </div>
    </Modal>
  );
}

// ---------- Player ----------

export default function WorkoutPlayer() {
  const { dayId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data, loading, error, reload } = useAsync(async () => {
    const day = await getProgramDay(dayId);
    const [workout, coach, session] = await Promise.all([getWorkout(day.workout_id), getCoachProfile(), findSession(profile.id, dayId)]);
    const exerciseIds = [...new Set(workout.blocks.flatMap((b) => b.items.map((i) => i.exercise_id)))];
    const [logs, last] = await Promise.all([
      session ? getSessionLogs(session.id) : { sets: [], blocks: [] },
      getLastPerformance(profile.id, exerciseIds, session?.id ?? NIL),
    ]);
    return { day, workout, coach, session, logs, last };
  }, [dayId, profile.id]);

  const [session, setSession] = useState(null);
  const [sets, setSets] = useState({}); // itemId -> { setNumber -> row }
  const [blockLogs, setBlockLogs] = useState({}); // blockId -> row
  const [extraSets, setExtraSets] = useState({});
  const [rest, setRest] = useState(null);
  const [timerBlock, setTimerBlock] = useState(null);
  const [prefill, setPrefill] = useState({});
  const [finishing, setFinishing] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [actionError, setActionError] = useState(null);
  const sessionPromise = useRef(null);

  useEffect(() => {
    if (!data) return;
    setSession(data.session);
    const s = {};
    for (const row of data.logs.sets) if (row.block_exercise_id) (s[row.block_exercise_id] ??= {})[row.set_number] = row;
    setSets(s);
    setBlockLogs(Object.fromEntries(data.logs.blocks.map((b) => [b.block_id, b])));
  }, [data]);

  const prs = useMemo(() => {
    const out = new Set();
    if (!data) return out;
    for (const block of data.workout.blocks)
      for (const item of block.items) {
        const best = data.last[item.exercise_id]?.bestKg ?? 0;
        if (best > 0 && Object.values(sets[item.id] ?? {}).some((r) => (r.load_kg ?? 0) > best)) out.add(item.exercise_id);
      }
    return out;
  }, [sets, data]);

  if (loading && !data) return <PageLoader />;
  if (error)
    return (
      <div className="client-page">
        <ErrorBox error={error} onRetry={reload} />
        <Link to="/app" className="btn mt-12">Back</Link>
      </div>
    );

  const { day, workout, coach, last } = data;
  const date = programDayDate(day.program?.start_date, day.week, day.day);
  const completed = Boolean(session?.completed_at);

  // Progress = finished sets + saved timed blocks, over planned.
  let planned = 0;
  let doneCount = 0;
  for (const b of workout.blocks) {
    if (isSetBased(b.format)) {
      for (const it of b.items) {
        planned += it.sets || 1;
        doneCount += Math.min(it.sets || 1, Object.keys(sets[it.id] ?? {}).length);
      }
    } else {
      planned += 1;
      if (blockLogs[b.id]) doneCount += 1;
    }
  }

  async function ensureSession() {
    if (session) return session;
    sessionPromise.current ??= getOrCreateSession({ clientId: profile.id, programDay: day, workout });
    try {
      const s = await sessionPromise.current;
      setSession(s);
      return s;
    } catch (e) {
      sessionPromise.current = null;
      throw e;
    }
  }

  // Sets save through the queue (lib/saveQueue): the screen updates straight
  // away and writes retry until they land, so bad signal never wipes a set.
  const putSet = (item, n, row) =>
    setSets((prev) => {
      const copy = { ...(prev[item.id] ?? {}) };
      if (row) copy[n] = row;
      else delete copy[n];
      return { ...prev, [item.id]: copy };
    });

  async function toggleSet(item, n, values, restSec = item.rest_sec) {
    unlockAudio();
    setActionError(null);
    const existing = sets[item.id]?.[n];
    if (existing) {
      putSet(item, n, null);
      queueSetLogDelete("set_logs", existing.session_id, item.id, n, { onError: setActionError });
      return;
    }
    const draft = { block_exercise_id: item.id, exercise_id: item.exercise_id, set_number: n, done: true, ...values };
    putSet(item, n, { ...draft, id: "pending" });
    setRest(timerAfterSet(item, values, restSec));
    let s;
    try {
      s = await ensureSession(); // the first set of a workout needs the network once
    } catch (e) {
      putSet(item, n, null);
      setActionError(e);
      return;
    }
    const row = { ...draft, session_id: s.id };
    putSet(item, n, { ...row, id: "pending" });
    queueSetLog("set_logs", row, { onSaved: (saved) => putSet(item, n, saved), onError: setActionError });
  }

  function updateSet(item, n, values) {
    const existing = sets[item.id]?.[n];
    if (!existing?.session_id) return;
    const row = { ...existing, ...values };
    putSet(item, n, row);
    queueSetLog("set_logs", row, { onSaved: (saved) => putSet(item, n, saved), onError: setActionError });
  }

  async function saveBlock(block, values) {
    setActionError(null);
    try {
      const s = await ensureSession();
      const saved = await upsertBlockLog({ session_id: s.id, block_id: block.id, ...values });
      setBlockLogs((b) => ({ ...b, [block.id]: saved }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function finish(values) {
    try {
      const s = await ensureSession();
      await completeSession(s.id, values);
      const [allSessions, program] = await Promise.all([listSessions(profile.id), getActiveProgramFor(profile.id)]);
      const xp = totalXp(allSessions);
      const level = levelFor(xp);
      const before = levelFor(xp - XP_PER_WORKOUT);
      const streak = program ? workoutStreak(program.days, sessionsByDay(allSessions), todayISO()) : 0;
      const logged = Object.values(sets).flatMap((bySet) => Object.values(bySet));
      const volume = Math.round(logged.reduce((n, r) => n + (Number(r.load_kg) || 0) * (Number(r.reps) || 0), 0));
      const minutes = Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000);
      const done = logged.length + Object.keys(blockLogs).length;
      const card = {
        name: firstName(profile.full_name) || "Athlete",
        title: workout.title,
        date: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" }),
        level,
        line: companionLine("finished", { name: firstName(profile.full_name) }),
        stats: [
          volume > 0
            ? { value: volume.toLocaleString("en").replace(/,/g, " "), label: "kg lifted" }
            : { value: minutes > 0 && minutes < 240 ? String(minutes) : "✓", label: minutes > 0 && minutes < 240 ? "minutes" : "done" },
          { value: String(done), label: logged.length ? "sets done" : "blocks done" },
          { value: String(prs.size), label: prs.size === 1 ? "new PR" : "new PRs", highlight: prs.size > 0 },
          { value: String(streak), label: "workout streak", highlight: streak >= 3 },
        ],
      };
      setFinishing(false);
      setCelebration({ streak, prs: prs.size, level, leveledUp: level.number > before.number, card });
    } catch (e) {
      setFinishing(false);
      setActionError(e);
    }
  }

  return (
    <div className="client-shell" style={{ paddingBottom: 120 }}>
      <div className="player-top">
        <div className="row">
          <Link to="/app" className="icon-btn" aria-label="Back">
            <ArrowLeft size={20} />
          </Link>
          <div className="grow">
            <div className="h3 ellipsis">{workout.title}</div>
            <div className="tiny faint">{date ? formatDateTime(date + "T12:00") : `Week ${day.week}`}</div>
          </div>
          <span className="small faint nowrap">
            {doneCount}/{planned}
          </span>
        </div>
        <div className="mt-8">
          <ProgressBar value={planned ? doneCount / planned : 0} />
        </div>
      </div>

      <div className="client-page col gap-16">
        {!session && (
          <Companion mood={MOODS.workoutToday} coachAvatar={coach?.avatar_url}>
            {workout.description || companionLine("workoutToday", { name: firstName(profile.full_name), workout: workout.title })}
          </Companion>
        )}
        {!session && estimateWorkoutSec(workout.blocks) > 0 && (
          <div className="small muted row gap-6">
            <Timer size={15} /> Takes {formatEstimate(estimateWorkoutSec(workout.blocks)).replace("≈ ", "about ")}
          </div>
        )}
        {session && workout.description && <div className="card card-tight small muted">{workout.description}</div>}
        {completed && (
          <div className="ok-box row gap-6">
            <Check size={16} /> Completed {formatDateTime(session.completed_at)}. You can still edit your logs.
          </div>
        )}
        <SavingNote />
        <ErrorBox error={actionError} />

        {workout.blocks.map((block, bi) => (
          <div key={block.id} className="block-card">
            <div className="block-head row">
              <div className="letter">{String.fromCharCode(65 + bi)}</div>
              <div className="grow">
                <div className="h3">{block.name || formatLabel(block.format)}</div>
                {block.format === "superset" && <div className="tiny muted">Superset · {Math.max(1, ...block.items.map((i) => i.sets || 1))} rounds · one set of each, then rest</div>}
                {!isSetBased(block.format) && <div className="tiny muted">{formatLabel(block.format)} · {blockSummary(block)}</div>}
              </div>
              {!isSetBased(block.format) && blockLogs[block.id] && <Check size={20} className="green" />}
            </div>

            {block.notes && <div className="exercise small muted">{block.notes}</div>}

            {block.format === "superset" ? (
              <SupersetRounds
                block={block}
                letter={String.fromCharCode(65 + bi)}
                sets={sets}
                last={last}
                prs={prs}
                extraRounds={extraSets[block.id] ?? 0}
                onAddRound={() => setExtraSets((x) => ({ ...x, [block.id]: (x[block.id] ?? 0) + 1 }))}
                onToggle={toggleSet}
                onUpdate={updateSet}
              />
            ) : isSetBased(block.format)
              ? block.items.map((item, ii) => (
                  <ExerciseSets
                    key={item.id}
                    {...setItemProps(block, ii, String.fromCharCode(65 + bi))}
                    item={item}
                    sets={sets[item.id] ?? {}}
                    last={last[item.exercise_id]}
                    isPR={prs.has(item.exercise_id)}
                    extra={extraSets[item.id] ?? 0}
                    onAddSet={() => setExtraSets((x) => ({ ...x, [item.id]: (x[item.id] ?? 0) + 1 }))}
                    onToggle={toggleSet}
                    onUpdate={updateSet}
                  />
                ))
              : (
                <div className="exercise col">
                  <div className="col gap-6">
                    {block.items.map((item) => (
                      <div key={item.id} className="row between">
                        <div className="grow">
                          <div style={{ fontWeight: 700 }}>{item.exercise?.name}</div>
                          <div className="tiny yellow">{prescription(item, block.format, item.exercise?.tracking)}</div>
                          {item.notes && <div className="tiny muted">{item.notes}</div>}
                        </div>
                        <VideoButton exercise={item.exercise} size={17} />
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-block" onClick={() => { unlockAudio(); setTimerBlock(block); }}>
                    <Play size={17} fill="currentColor" /> Start timer
                  </button>
                  <BlockResult block={block} logged={blockLogs[block.id]} prefill={prefill[block.id]} onSave={(v) => saveBlock(block, v)} />
                </div>
              )}
          </div>
        ))}

        {workout.blocks.length === 0 && <div className="empty">This workout is still being written by your coach.</div>}

        {!completed && workout.blocks.length > 0 && (
          <button className="btn btn-primary btn-lg btn-block mt-8" onClick={() => setFinishing(true)}>
            <Check size={20} /> Finish workout
          </button>
        )}
      </div>

      {rest && !timerBlock && <RestBar rest={rest} onDone={() => setRest(nextTimer)} onAdd={() => setRest((r) => ({ ...r, endsAt: r.endsAt + 15000 }))} />}
      {timerBlock && (
        <BlockTimer
          block={timerBlock}
          onClose={() => setTimerBlock(null)}
          onFinish={(result) => {
            setPrefill((p) => ({ ...p, [timerBlock.id]: result }));
            setTimerBlock(null);
          }}
        />
      )}
      {finishing && <FinishModal onClose={() => setFinishing(false)} onSubmit={finish} />}
      {celebration && <Celebration coach={coach} name={firstName(profile.full_name)} stats={celebration} onClose={() => navigate("/app")} />}
    </div>
  );
}
