import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { copyWorkout, getWorkout, listExercises, saveWorkout } from "../lib/api";
import { FORMATS, estimateWorkoutSec, exerciseMeta, formatClock, formatEstimate, isSetBased, parseDuration } from "../lib/format";
import { useCoachBase } from "../lib/base";
import { ErrorBox, PageLoader, useAsync } from "../components/ui";
import ExercisePicker from "../components/ExercisePicker";

const uid = () => crypto.randomUUID();

const FORMAT_DEFAULTS = {
  sets: { rounds: null, work_sec: null, rest_sec: null, time_cap_sec: null },
  superset: { rounds: null, work_sec: null, rest_sec: null, time_cap_sec: null },
  circuit: { rounds: 3, rest_sec: 60, work_sec: null, time_cap_sec: null },
  intervals: { rounds: 8, work_sec: 40, rest_sec: 20, time_cap_sec: null },
  amrap: { time_cap_sec: 600, rounds: null, work_sec: null, rest_sec: null },
  emom: { rounds: 10, work_sec: null, rest_sec: null, time_cap_sec: null },
};

function newItem(exercise, format) {
  const t = exercise.tracking;
  return {
    id: uid(),
    exercise_id: exercise.id,
    exercise,
    sets: isSetBased(format) ? 3 : null,
    reps: format !== "intervals" && (t === "weight_reps" || t === "reps") ? "10" : "",
    load: "",
    duration_sec: t === "time" || t === "weight_time" ? 30 : null,
    distance_m: null,
    rest_sec: format === "sets" ? 90 : null, // supersets: set once for the round
    tempo: "",
    notes: "",
  };
}

// Text box for a duration: accepts "90" or "1:30", stores seconds.
function DurationInput({ value, onChange, placeholder = "0:30" }) {
  const [text, setText] = useState(value != null ? formatClock(value) : "");
  useEffect(() => setText(value != null ? formatClock(value) : ""), [value]);
  return (
    <input
      className="input input-sm"
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseDuration(text))}
    />
  );
}

function NumInput({ value, onChange, ...rest }) {
  return (
    <input
      className="input input-sm"
      type="number"
      inputMode="numeric"
      min={0}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

function F({ label, children, wide }) {
  return (
    <label className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      {children}
    </label>
  );
}

// `roundRest`: for supersets, the rest after the whole round (shown on the last
// exercise only; null on the others).
function ItemFields({ item, format, onChange, roundRest }) {
  const t = item.exercise?.tracking ?? "weight_reps";
  const set = (patch) => onChange({ ...item, ...patch });
  const showReps = t === "weight_reps" || t === "reps";
  const showLoad = t === "weight_reps" || t === "weight_time" || !isSetBased(format);
  const showTime = t === "time" || t === "distance_time" || t === "weight_time";
  const showDist = t === "distance_time";
  const intervals = format === "intervals";

  return (
    <div className="builder-fields">
      {isSetBased(format) && (
        <F label={format === "superset" ? "Rounds" : "Sets"}>
          <NumInput value={item.sets} onChange={(v) => set({ sets: v })} />
        </F>
      )}
      {showReps && !intervals && (
        <F label="Reps">
          <input className="input input-sm" value={item.reps ?? ""} placeholder="8-10" onChange={(e) => set({ reps: e.target.value })} />
        </F>
      )}
      {showDist && !intervals && (
        <F label="Distance (m)">
          <NumInput value={item.distance_m} onChange={(v) => set({ distance_m: v })} placeholder="5000" />
        </F>
      )}
      {showTime && !intervals && (
        <F label={t === "weight_time" ? "Time" : "Work"}>
          <DurationInput value={item.duration_sec} onChange={(v) => set({ duration_sec: v })} />
        </F>
      )}
      {showLoad && (
        <F label="Load">
          <input className="input input-sm" value={item.load ?? ""} placeholder={t === "weight_reps" || t === "weight_time" ? "60 kg / RPE 8" : "optional"} onChange={(e) => set({ load: e.target.value })} />
        </F>
      )}
      {isSetBased(format) && (
        <>
          {format === "sets" && (
            <F label="Rest">
              <DurationInput value={item.rest_sec} onChange={(v) => set({ rest_sec: v })} placeholder="1:30" />
            </F>
          )}
          {roundRest && (
            <F label="Rest after round">
              <DurationInput value={roundRest.value} onChange={roundRest.onChange} placeholder="1:30" />
            </F>
          )}
          <F label="Tempo">
            <input className="input input-sm" value={item.tempo ?? ""} placeholder="3-1-1-0" onChange={(e) => set({ tempo: e.target.value })} />
          </F>
        </>
      )}
      <F label="Coach note" wide>
        <input className="input input-sm" value={item.notes ?? ""} placeholder="Cue, variation, or what to focus on" onChange={(e) => set({ notes: e.target.value })} />
      </F>
    </div>
  );
}

function BlockParams({ block, onChange }) {
  const set = (patch) => onChange({ ...block, ...patch });
  switch (block.format) {
    case "circuit":
      return (
        <div className="builder-fields" style={{ maxWidth: 360 }}>
          <F label="Rounds"><NumInput value={block.rounds} onChange={(v) => set({ rounds: v })} /></F>
          <F label="Rest between rounds"><DurationInput value={block.rest_sec} onChange={(v) => set({ rest_sec: v })} /></F>
        </div>
      );
    case "intervals":
      return (
        <div className="builder-fields" style={{ maxWidth: 420 }}>
          <F label="Rounds"><NumInput value={block.rounds} onChange={(v) => set({ rounds: v })} /></F>
          <F label="Work"><DurationInput value={block.work_sec} onChange={(v) => set({ work_sec: v })} /></F>
          <F label="Rest"><DurationInput value={block.rest_sec} onChange={(v) => set({ rest_sec: v })} /></F>
        </div>
      );
    case "amrap":
      return (
        <div className="builder-fields" style={{ maxWidth: 200 }}>
          <F label="Time cap"><DurationInput value={block.time_cap_sec} onChange={(v) => set({ time_cap_sec: v })} placeholder="10:00" /></F>
        </div>
      );
    case "emom":
      return (
        <div className="builder-fields" style={{ maxWidth: 200 }}>
          <F label="Minutes"><NumInput value={block.rounds} onChange={(v) => set({ rounds: v })} /></F>
        </div>
      );
    default:
      return null;
  }
}

function move(list, index, delta) {
  const next = [...list];
  const [x] = next.splice(index, 1);
  next.splice(index + delta, 0, x);
  return next;
}

export default function WorkoutBuilderPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const base = useCoachBase();
  const back = params.get("back") || `${base}/workouts`;

  const { data, loading, error, reload } = useAsync(async () => {
    const [workout, exercises] = await Promise.all([getWorkout(id), listExercises()]);
    return { workout, exercises };
  }, [id]);

  const [original, setOriginal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [picking, setPicking] = useState(null); // block id
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!data) return;
    setOriginal(data.workout);
    setDraft(structuredClone(data.workout));
    setExercises(data.exercises);
  }, [data]);

  const dirty = useMemo(() => original && draft && JSON.stringify(original) !== JSON.stringify(draft), [original, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!draft) return <PageLoader />;

  const setBlock = (blockId, next) => setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? next : b)) }));
  const setItem = (blockId, itemId, next) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, items: b.items.map((i) => (i.id === itemId ? next : i)) } : b)) }));

  function addBlock() {
    setDraft((d) => ({ ...d, blocks: [...d.blocks, { id: uid(), name: "", format: "sets", notes: "", ...FORMAT_DEFAULTS.sets, items: [] }] }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await saveWorkout(draft, original);
      setOriginal(fresh);
      setDraft(structuredClone(fresh));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
      return fresh;
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (dirty && !(await save())) return;
    try {
      const newId = await copyWorkout(draft.id, true);
      navigate(`${base}/workouts/${newId}`);
    } catch (e) {
      setSaveError(e);
    }
  }

  function goBack(e) {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <Link to={back} onClick={goBack} className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> {back.startsWith("/coach/programs") ? "Back to program" : back.startsWith("/pt/sessions") ? "Back to session" : "Workout templates"}
      </Link>

      <div className="row wrap gap-6 mb-8">
        {draft.is_template ? <span className="pill pill-blue">Workout template</span> : <span className="pill">{back.startsWith("/pt/sessions") ? "In a session" : "In a program"}</span>}
      </div>
      <input
        className="input input-bare h1"
        style={{ fontSize: 30 }}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Workout title"
      />
      {estimateWorkoutSec(draft.blocks) > 0 && (
        <div className="small muted mt-4">
          Estimated time <b className="yellow">{formatEstimate(estimateWorkoutSec(draft.blocks))}</b> · counts the exercises here, so add your warm-up as a block to include it
        </div>
      )}
      <textarea
        className="textarea mt-8"
        style={{ minHeight: 56 }}
        value={draft.description ?? ""}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        placeholder="Intro for the client: goal of the session, warm-up instructions, how it should feel…"
      />

      <div className="col gap-16 mt-16">
        {draft.blocks.map((block, bi) => (
          <div key={block.id} className="builder-block">
            <div className="builder-block-head">
              <div className="letter">{String.fromCharCode(65 + bi)}</div>
              <input
                className="input input-sm grow"
                style={{ minWidth: 140 }}
                value={block.name}
                placeholder={bi === 0 ? "Warm-up, Strength, Finisher…" : "Block name (optional)"}
                onChange={(e) => setBlock(block.id, { ...block, name: e.target.value })}
              />
              <select
                className="select input-sm"
                style={{ width: "auto" }}
                value={block.format}
                onChange={(e) => {
                  const format = e.target.value;
                  setBlock(block.id, {
                    ...block,
                    format,
                    ...FORMAT_DEFAULTS[format],
                    items: block.items.map((i) => ({ ...i, sets: isSetBased(format) ? i.sets ?? 3 : null, rest_sec: isSetBased(format) ? i.rest_sec : null })),
                  });
                }}
              >
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div className="row gap-4">
                <button className="icon-btn" disabled={bi === 0} onClick={() => setDraft((d) => ({ ...d, blocks: move(d.blocks, bi, -1) }))} aria-label="Move block up">
                  <ArrowUp size={16} />
                </button>
                <button className="icon-btn" disabled={bi === draft.blocks.length - 1} onClick={() => setDraft((d) => ({ ...d, blocks: move(d.blocks, bi, 1) }))} aria-label="Move block down">
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => (block.items.length === 0 || window.confirm("Delete this block and its exercises?")) && setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== block.id) }))}
                  aria-label="Delete block"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {block.format !== "sets" && (
              <div className="builder-item">
                <div className="tiny muted">{FORMATS.find((f) => f.id === block.format)?.hint}</div>
                <BlockParams block={block} onChange={(next) => setBlock(block.id, next)} />
              </div>
            )}
            {block.items.map((item, ii) => (
              <div key={item.id} className="builder-item">
                <div className="row between">
                  <div className="row gap-6 grow">
                    <span className="faint small">{block.format === "superset" ? `${String.fromCharCode(65 + bi)}${ii + 1}` : `${ii + 1}.`}</span>
                    <span style={{ fontWeight: 700 }} className="ellipsis">
                      {item.exercise?.name ?? "Exercise"}
                    </span>
                    {exerciseMeta(item.exercise) && <span className="tiny muted nowrap">{exerciseMeta(item.exercise)}</span>}
                  </div>
                  <div className="row gap-4">
                    <button className="icon-btn" disabled={ii === 0} onClick={() => setBlock(block.id, { ...block, items: move(block.items, ii, -1) })} aria-label="Move up">
                      <ArrowUp size={15} />
                    </button>
                    <button className="icon-btn" disabled={ii === block.items.length - 1} onClick={() => setBlock(block.id, { ...block, items: move(block.items, ii, 1) })} aria-label="Move down">
                      <ArrowDown size={15} />
                    </button>
                    <button className="icon-btn" onClick={() => setBlock(block.id, { ...block, items: block.items.filter((i) => i.id !== item.id) })} aria-label="Remove exercise">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <ItemFields
                  item={item}
                  format={block.format}
                  onChange={(next) => setItem(block.id, item.id, next)}
                  roundRest={
                    block.format === "superset" && ii === block.items.length - 1
                      ? {
                          value: Math.max(0, ...block.items.map((i) => i.rest_sec || 0)) || null,
                          // Keep the round's rest on the last exercise only.
                          onChange: (v) =>
                            setBlock(block.id, { ...block, items: block.items.map((i, k) => ({ ...i, rest_sec: k === block.items.length - 1 ? v : null })) }),
                        }
                      : null
                  }
                />
              </div>
            ))}
            <div style={{ padding: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPicking(block.id)}>
                <Plus size={15} /> Add exercise
              </button>
            </div>
          </div>
        ))}

        <button className="btn btn-ghost" style={{ borderStyle: "dashed", borderRadius: 14, padding: 16 }} onClick={addBlock}>
          <Plus size={17} /> Add block
        </button>
      </div>

      <ErrorBox error={saveError} />

      <div className="save-bar">
        <span className="small muted">{saving ? "Saving…" : savedFlash ? "Saved ✓" : dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="row gap-6">
          <button className="btn btn-ghost btn-sm" onClick={saveAsTemplate}>
            <Copy size={14} /> {draft.is_template ? "Duplicate" : "Save as template"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
            Save
          </button>
        </div>
      </div>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          onClose={() => setPicking(null)}
          onCreated={(ex) => setExercises((list) => [...list, ex].sort((a, b) => a.name.localeCompare(b.name)))}
          onPick={(ex) => {
            const block = draft.blocks.find((b) => b.id === picking);
            setBlock(picking, { ...block, items: [...block.items, newItem(ex, block.format)] });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
