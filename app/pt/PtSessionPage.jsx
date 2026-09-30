import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  addExerciseToWorkout,
  deletePtSession,
  deletePtSetLog,
  getPtLastPerformance,
  getPtSession,
  getPtSessionLogs,
  getWorkout,
  listExercises,
  updatePtSession,
  upsertPtBlockLog,
  upsertPtSetLog,
} from "../lib/api";
import { formatDate, todayISO } from "../lib/dates";
import { blockSummary, formatLabel, isSetBased, prescription, setItemProps } from "../lib/format";
import { unlockAudio } from "../lib/sound";
import { CommitInput, ErrorBox, PageLoader, ProgressBar, useAsync } from "../components/ui";
import ExercisePicker from "../components/ExercisePicker";
import { BlockResult, ExerciseSets, RestBar, SupersetRounds } from "../client/WorkoutPlayer";
import BlockTimer from "../client/BlockTimer";

// One in-person session: Florian logs the client's sets on his phone as they
// train. Everything saves as it's ticked, so closing the app mid-session
// loses nothing, and finished sessions stay editable.
export default function PtSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const session = await getPtSession(id);
    const [workout, logs, exercises] = await Promise.all([
      session.workout_id ? getWorkout(session.workout_id) : { id: null, title: session.workout_title, blocks: [] },
      getPtSessionLogs(id),
      listExercises(),
    ]);
    const exerciseIds = [...new Set(workout.blocks.flatMap((b) => b.items.map((i) => i.exercise_id)))];
    const last = await getPtLastPerformance(session.client_id, exerciseIds, id);
    return { session, workout, logs, exercises, last };
  }, [id]);

  const [sets, setSets] = useState({}); // itemId -> { setNumber -> row }
  const [blockLogs, setBlockLogs] = useState({}); // blockId -> row
  const [extraSets, setExtraSets] = useState({});
  const [rest, setRest] = useState(null);
  const [timerBlock, setTimerBlock] = useState(null);
  const [prefill, setPrefill] = useState({});
  const [picking, setPicking] = useState(false);
  const [actionError, setActionError] = useState(null);
  const loadedFor = useRef(null);

  // Only (re)build the set state when a different session loads, so adding
  // an exercise mid-session doesn't wipe what was just ticked.
  useEffect(() => {
    if (!data || loadedFor.current === data.session.id) return;
    loadedFor.current = data.session.id;
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
        <Link to="/pt" className="btn mt-12">Back</Link>
      </div>
    );

  const { session, workout, last, exercises } = data;
  const clientLink = `/pt/clients/${session.client_id}`;
  const completed = Boolean(session.completed_at);

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

  async function saveSession(patch) {
    setActionError(null);
    try {
      const saved = await updatePtSession(id, patch);
      setData((d) => ({ ...d, session: { ...d.session, ...saved } }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function toggleSet(item, n, values, restSec = item.rest_sec) {
    unlockAudio();
    setActionError(null);
    const existing = sets[item.id]?.[n];
    try {
      if (existing) {
        setSets((s) => {
          const copy = { ...(s[item.id] ?? {}) };
          delete copy[n];
          return { ...s, [item.id]: copy };
        });
        await deletePtSetLog(id, item.id, n);
      } else {
        const row = { session_id: id, block_exercise_id: item.id, exercise_id: item.exercise_id, set_number: n, done: true, ...values };
        setSets((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [n]: { ...row, id: "pending" } } }));
        if (restSec) setRest({ endsAt: Date.now() + restSec * 1000 });
        const saved = await upsertPtSetLog(row);
        setSets((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [n]: saved } }));
      }
    } catch (e) {
      setActionError(e);
      loadedFor.current = null;
      reload();
    }
  }

  async function updateSet(item, n, values) {
    const existing = sets[item.id]?.[n];
    if (!existing || existing.id === "pending") return;
    try {
      const saved = await upsertPtSetLog({ ...existing, ...values, id: undefined, created_at: undefined });
      setSets((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [n]: saved } }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function saveBlock(block, values) {
    setActionError(null);
    try {
      const saved = await upsertPtBlockLog({ session_id: id, block_id: block.id, ...values });
      setBlockLogs((b) => ({ ...b, [block.id]: saved }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function addExercise(exercise) {
    setPicking(false);
    setActionError(null);
    try {
      const fresh = await addExerciseToWorkout(workout, exercise);
      const more = last[exercise.id] ? {} : await getPtLastPerformance(session.client_id, [exercise.id], id);
      setData((d) => ({ ...d, workout: fresh, last: { ...d.last, ...more } }));
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div className="client-shell" style={{ paddingBottom: 120 }}>
      <div className="player-top">
        <div className="row">
          <Link to={clientLink} className="icon-btn" aria-label="Back">
            <ArrowLeft size={20} />
          </Link>
          <div className="grow">
            <div className="h3 ellipsis">{session.client?.full_name}</div>
            <div className="tiny faint ellipsis">
              {workout.title} · {formatDate(session.session_date)}
            </div>
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
        <div className="grid-2">
          <label className="field">
            <span>Date</span>
            <input className="input input-sm" type="date" value={session.session_date} onChange={(e) => saveSession({ session_date: e.target.value || todayISO() })} />
          </label>
          <div className="field">
            <span>Workout</span>
            {workout.id ? (
              <Link to={`/pt/workouts/${workout.id}?back=/pt/sessions/${id}`} className="btn btn-sm btn-ghost">
                <Pencil size={14} /> Edit exercises
              </Link>
            ) : (
              <span className="small faint">Removed</span>
            )}
          </div>
        </div>

        {workout.description && <div className="card card-tight small muted pre">{workout.description}</div>}
        {completed && (
          <div className="ok-box row gap-6">
            <Check size={16} /> Session finished. You can still change anything.
          </div>
        )}
        <ErrorBox error={actionError} />

        {workout.blocks.map((block, bi) => (
          <div key={block.id} className="block-card">
            <div className="block-head row">
              <div className="letter">{String.fromCharCode(65 + bi)}</div>
              <div className="grow">
                <div className="h3">{block.name || formatLabel(block.format)}</div>
                {block.format === "superset" && <div className="tiny muted">Superset · {Math.max(1, ...block.items.map((i) => i.sets || 1))} rounds · one set of each, then rest</div>}
                {!isSetBased(block.format) && (
                  <div className="tiny muted">
                    {formatLabel(block.format)} · {blockSummary(block)}
                  </div>
                )}
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
            ) : isSetBased(block.format) ? (
              block.items.map((item, ii) => (
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
            ) : (
              <div className="exercise col">
                <div className="col gap-6">
                  {block.items.map((item) => (
                    <div key={item.id}>
                      <div style={{ fontWeight: 700 }}>{item.exercise?.name}</div>
                      <div className="tiny yellow">{prescription(item, block.format, item.exercise?.tracking)}</div>
                      {item.notes && <div className="tiny muted">{item.notes}</div>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    unlockAudio();
                    setTimerBlock(block);
                  }}
                >
                  <Play size={17} fill="currentColor" /> Start timer
                </button>
                <BlockResult block={block} logged={blockLogs[block.id]} prefill={prefill[block.id]} onSave={(v) => saveBlock(block, v)} />
              </div>
            )}
          </div>
        ))}

        {workout.id && (
          <button className="btn btn-ghost btn-block" onClick={() => setPicking(true)}>
            <Plus size={17} /> Add exercise
          </button>
        )}

        <div className="card col gap-12">
          <label className="field">
            <span>Session notes</span>
            <CommitInput
              multiline
              value={session.notes}
              onCommit={(v) => saveSession({ notes: v.trim() || null })}
              placeholder="How it went, what to change next time, how the body felt…"
            />
          </label>
          <div>
            <div className="row between">
              <div className="eyebrow">How hard was it? (RPE)</div>
              {session.rpe && (
                <button className="link-btn tiny" onClick={() => saveSession({ rpe: null })}>
                  Clear
                </button>
              )}
            </div>
            <div className="rpe-row mt-8">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} className={session.rpe === n ? "active" : ""} onClick={() => saveSession({ rpe: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!completed ? (
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={async () => {
              await saveSession({ completed_at: new Date().toISOString() });
              navigate(clientLink);
            }}
          >
            <Check size={20} /> Finish session
          </button>
        ) : (
          <Link to={clientLink} className="btn btn-lg btn-block">
            Done
          </Link>
        )}

        <button
          className="link-btn small red"
          style={{ alignSelf: "center" }}
          onClick={async () => {
            if (!window.confirm("Delete this session and everything logged in it?")) return;
            try {
              await deletePtSession(id);
              navigate(clientLink);
            } catch (e) {
              setActionError(e);
            }
          }}
        >
          <Trash2 size={13} /> Delete session
        </button>
      </div>

      {rest && !timerBlock && <RestBar rest={rest} onDone={() => setRest(null)} onAdd={() => setRest((r) => ({ endsAt: r.endsAt + 15000 }))} />}
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
      {picking && (
        <ExercisePicker
          exercises={exercises}
          onCreated={(ex) => setData((d) => ({ ...d, exercises: [...d.exercises, ex] }))}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
