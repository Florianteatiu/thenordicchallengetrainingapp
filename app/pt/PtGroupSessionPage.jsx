import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Play, Plus, Trophy, UserPlus, X } from "lucide-react";
import {
  addExerciseToWorkout,
  addPtGroupSessionMember,
  deletePtGroupSession,
  deletePtSession,
  deletePtSetLog,
  getPtGroupSession,
  listExercises,
  listPtClients,
  setPtGroupSessionDone,
  updatePtSession,
  upsertPtBlockLog,
  upsertPtSetLog,
} from "../lib/api";
import { formatDate } from "../lib/dates";
import { blockSummary, firstName, formatLabel, isSetBased, prescription, setItemProps } from "../lib/format";
import { unlockAudio } from "../lib/sound";
import { CommitInput, ErrorBox, Modal, PageLoader, ProgressBar, useAsync } from "../components/ui";
import ExercisePicker from "../components/ExercisePicker";
import { BlockResult, ExerciseHeader, SetsGrid, VideoButton, lastTimeText } from "../client/WorkoutPlayer";
import BlockTimer from "../client/BlockTimer";

// Who's in the session (and on which workout); add or remove people.
function PeopleModal({ data, onClose, onAdded, onRemoved }) {
  const clients = useAsync(listPtClients, []);
  const [workoutId, setWorkoutId] = useState(data.workouts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inSession = new Set(data.people.map((p) => p.client_id));
  const letter = (wid) => String.fromCharCode(65 + data.workouts.findIndex((w) => w.id === wid));

  async function add(client) {
    setBusy(true);
    setError(null);
    try {
      const w = data.workouts.find((x) => x.id === workoutId) ?? data.workouts[0];
      onAdded(await addPtGroupSessionMember({ groupSession: data.session, clientId: client.id, workout: w }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Take ${p.client.full_name} out of this session? What was logged for them today is deleted.`)) return;
    setBusy(true);
    try {
      await deletePtSession(p.id);
      onRemoved(p.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="People" onClose={onClose}>
      <div className="list">
        {data.people.map((p) => (
          <div key={p.id} className="card card-tight row">
            <span className="grow" style={{ fontWeight: 600 }}>
              {p.client.full_name}
            </span>
            {data.workouts.length > 1 && <span className="pill">{letter(p.workout_id)}</span>}
            <button className="icon-btn" onClick={() => remove(p)} disabled={busy} aria-label={`Remove ${p.client.full_name}`}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="eyebrow mt-24 mb-8">Add someone</div>
      {data.workouts.length > 1 && (
        <div className="seg mb-12">
          {data.workouts.map((w, i) => (
            <button key={w.id} className={workoutId === w.id ? "on" : ""} onClick={() => setWorkoutId(w.id)}>
              {String.fromCharCode(65 + i)} · {w.title}
            </button>
          ))}
        </div>
      )}
      <div className="list" style={{ maxHeight: 260, overflowY: "auto" }}>
        {(clients.data ?? [])
          .filter((c) => !c.archived && !inSession.has(c.id))
          .map((c) => (
            <button key={c.id} className="card card-tight card-link row" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => add(c)} disabled={busy}>
              <UserPlus size={16} className="yellow" />
              <span style={{ fontWeight: 600 }}>{c.full_name}</span>
            </button>
          ))}
      </div>
      <ErrorBox error={error || clients.error} />
    </Modal>
  );
}

export default function PtGroupSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [d, exercises] = await Promise.all([getPtGroupSession(id), listExercises()]);
    return { ...d, exercises };
  }, [id]);

  const [tab, setTab] = useState(0); // which workout (A/B)
  const [sets, setSets] = useState({}); // sessionId -> itemId -> setNumber -> row
  const [blockLogs, setBlockLogs] = useState({}); // sessionId -> blockId -> row
  const [extraSets, setExtraSets] = useState({}); // `${sessionId}:${itemId}` -> n
  const [timerBlock, setTimerBlock] = useState(null);
  const [prefill, setPrefill] = useState({});
  const [picking, setPicking] = useState(false);
  const [people, setPeople] = useState(false);
  const [actionError, setActionError] = useState(null);
  const loadedFor = useRef(null);

  // Build the logged state once per session, so adding an exercise or a
  // person mid-session doesn't wipe what was just ticked.
  useEffect(() => {
    if (!data || loadedFor.current === data.session.id) return;
    loadedFor.current = data.session.id;
    const s = {};
    for (const r of data.sets) if (r.block_exercise_id) ((s[r.session_id] ??= {})[r.block_exercise_id] ??= {})[r.set_number] = r;
    setSets(s);
    const b = {};
    for (const r of data.blocks) (b[r.session_id] ??= {})[r.block_id] = r;
    setBlockLogs(b);
  }, [data]);

  const workout = data?.workouts[Math.min(tab, (data?.workouts.length ?? 1) - 1)];
  const group = useMemo(() => (data && workout ? data.people.filter((p) => p.workout_id === workout.id) : []), [data, workout]);

  if (loading && !data) return <PageLoader />;
  if (error)
    return (
      <div className="client-page">
        <ErrorBox error={error} onRetry={reload} />
        <Link to="/pt/groups" className="btn mt-12">
          Back
        </Link>
      </div>
    );

  const { session } = data;
  const done = Boolean(session.completed_at);
  const back = session.group_id ? `/pt/groups/${session.group_id}` : "/pt/groups";

  // Progress across everyone and both workouts.
  let planned = 0;
  let doneCount = 0;
  for (const p of data.people) {
    const w = data.workouts.find((x) => x.id === p.workout_id);
    for (const b of w?.blocks ?? []) {
      if (isSetBased(b.format))
        for (const it of b.items) {
          planned += it.sets || 1;
          doneCount += Math.min(it.sets || 1, Object.keys(sets[p.id]?.[it.id] ?? {}).length);
        }
      else {
        planned += 1;
        if (blockLogs[p.id]?.[b.id]) doneCount += 1;
      }
    }
  }

  async function toggleSet(person, item, n, values) {
    unlockAudio();
    setActionError(null);
    const existing = sets[person.id]?.[item.id]?.[n];
    const put = (row) =>
      setSets((prev) => {
        const mine = { ...(prev[person.id] ?? {}) };
        const forItem = { ...(mine[item.id] ?? {}) };
        if (row) forItem[n] = row;
        else delete forItem[n];
        mine[item.id] = forItem;
        return { ...prev, [person.id]: mine };
      });
    try {
      if (existing) {
        put(null);
        await deletePtSetLog(person.id, item.id, n);
      } else {
        const row = { session_id: person.id, block_exercise_id: item.id, exercise_id: item.exercise_id, set_number: n, done: true, ...values };
        put({ ...row, id: "pending" });
        put(await upsertPtSetLog(row));
      }
    } catch (e) {
      setActionError(e);
    }
  }

  async function updateSet(person, item, n, values) {
    const existing = sets[person.id]?.[item.id]?.[n];
    if (!existing || existing.id === "pending") return;
    try {
      const saved = await upsertPtSetLog({ ...existing, ...values, id: undefined, created_at: undefined });
      setSets((prev) => ({ ...prev, [person.id]: { ...prev[person.id], [item.id]: { ...prev[person.id]?.[item.id], [n]: saved } } }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function saveBlock(person, block, values) {
    try {
      const saved = await upsertPtBlockLog({ session_id: person.id, block_id: block.id, ...values });
      setBlockLogs((b) => ({ ...b, [person.id]: { ...(b[person.id] ?? {}), [block.id]: saved } }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function toggleDone() {
    try {
      const gs = await setPtGroupSessionDone(session.id, !done);
      setData((d) => ({ ...d, session: gs }));
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div className="pt-shell" style={{ paddingBottom: 60 }}>
      <div className="player-top">
        <div className="row">
          <Link to={back} className="icon-btn" aria-label="Back">
            <ArrowLeft size={20} />
          </Link>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="h3 ellipsis">{session.group_name || "Group session"}</div>
            <div className="tiny faint">
              {formatDate(session.session_date, { weekday: "long", day: "numeric", month: "short" })} · {data.people.length} {data.people.length === 1 ? "person" : "people"}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setPeople(true)}>
            <UserPlus size={15} /> People
          </button>
        </div>
        <div className="mt-8">
          <ProgressBar value={planned ? doneCount / planned : 0} />
        </div>
        {data.workouts.length > 1 && (
          <div className="seg seg-full mt-8">
            {data.workouts.map((w, i) => (
              <button key={w.id} className={w.id === workout?.id ? "on" : ""} onClick={() => setTab(i)}>
                {String.fromCharCode(65 + i)} · {w.title} ({data.people.filter((p) => p.workout_id === w.id).length})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-main col gap-16">
        {done && (
          <div className="ok-box row gap-6">
            <Check size={16} /> Session finished. You can still edit the numbers.
          </div>
        )}
        <ErrorBox error={actionError} />

        {workout && (
          <div className="chips">
            {group.map((p) => (
              <Link key={p.id} to={`/pt/clients/${p.client_id}`} className="pill" title={p.client.injuries || undefined}>
                {firstName(p.client.full_name)}
                {p.client.injuries ? " ⚠" : ""}
              </Link>
            ))}
          </div>
        )}

        {!workout && <div className="empty">Nobody is in this session. Tap “People” to add someone.</div>}

        {workout?.blocks.map((block, bi) => {
          const letter = String.fromCharCode(65 + bi);
          return (
            <div key={block.id} className="block-card">
              <div className="block-head row">
                <div className="letter">{letter}</div>
                <div className="grow">
                  <div className="h3">{block.name || formatLabel(block.format)}</div>
                  {block.format === "superset" && <div className="tiny muted">Superset · back to back, rest after the round</div>}
                  {!isSetBased(block.format) && (
                    <div className="tiny muted">
                      {formatLabel(block.format)} · {blockSummary(block)}
                    </div>
                  )}
                </div>
              </div>
              {block.notes && <div className="exercise small muted">{block.notes}</div>}

              {isSetBased(block.format)
                ? block.items.map((item, ii) => {
                    const sp = setItemProps(block, ii, letter);
                    return (
                      <div key={item.id} className="exercise">
                        <ExerciseHeader item={item} label={sp.label} restSec={sp.restSec} nextLabel={sp.nextLabel} />
                        {group.map((p) => {
                          const last = data.last[p.id]?.[item.exercise_id];
                          const mine = sets[p.id]?.[item.id] ?? {};
                          const isPR = (last?.bestKg ?? 0) > 0 && Object.values(mine).some((r) => (r.load_kg ?? 0) > last.bestKg);
                          const key = `${p.id}:${item.id}`;
                          return (
                            <div key={p.id} className="person-sets">
                              <div className="row between">
                                <div className="row gap-6">
                                  <span style={{ fontWeight: 800 }}>{firstName(p.client.full_name)}</span>
                                  {isPR && (
                                    <span className="pill pill-yellow">
                                      <Trophy size={11} /> PR!
                                    </span>
                                  )}
                                </div>
                                {last && <span className="tiny faint ellipsis" style={{ maxWidth: "60%" }}>Last: {lastTimeText(last)}</span>}
                              </div>
                              <SetsGrid
                                item={item}
                                sets={mine}
                                last={last}
                                extra={extraSets[key] ?? 0}
                                onAddSet={() => setExtraSets((x) => ({ ...x, [key]: (x[key] ?? 0) + 1 }))}
                                onToggle={(it, n, v) => toggleSet(p, it, n, v)}
                                onUpdate={(it, n, v) => updateSet(p, it, n, v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
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
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => {
                        unlockAudio();
                        setTimerBlock(block);
                      }}
                    >
                      <Play size={17} fill="currentColor" /> Start timer
                    </button>
                    {group.map((p) => (
                      <div key={p.id} className="person-sets">
                        <div className="row gap-6 mb-8">
                          <span style={{ fontWeight: 800 }}>{firstName(p.client.full_name)}</span>
                          {blockLogs[p.id]?.[block.id] && <Check size={16} className="green" />}
                        </div>
                        <BlockResult block={block} logged={blockLogs[p.id]?.[block.id]} prefill={prefill[block.id]} onSave={(v) => saveBlock(p, block, v)} />
                      </div>
                    ))}
                  </div>
                )}
            </div>
          );
        })}

        {workout && (
          <button className="btn btn-ghost" style={{ borderStyle: "dashed", borderRadius: 14 }} onClick={() => setPicking(true)}>
            <Plus size={17} /> Add an exercise{data.workouts.length > 1 ? ` to ${String.fromCharCode(65 + tab)}` : ""}
          </button>
        )}

        {group.length > 0 && (
          <div className="section">
            <div className="eyebrow mb-8">Notes per person</div>
            <div className="col gap-6">
              {group.map((p) => (
                <label key={p.id} className="field">
                  <span>{p.client.full_name}</span>
                  <CommitInput
                    value={p.notes ?? ""}
                    placeholder="How did it go? Anything to remember next time?"
                    onCommit={async (v) => {
                      try {
                        const saved = await updatePtSession(p.id, { notes: v.trim() || null });
                        setData((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, notes: saved.notes } : x)) }));
                      } catch (e) {
                        setActionError(e);
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <button className={`btn btn-lg btn-block mt-8 ${done ? "btn-ghost" : "btn-primary"}`} onClick={toggleDone}>
          <Check size={20} /> {done ? "Re-open session" : "Finish session"}
        </button>
        <button
          className="btn btn-danger btn-sm"
          style={{ alignSelf: "center" }}
          onClick={async () => {
            if (!window.confirm("Delete this whole group session, including everything logged in it?")) return;
            try {
              await deletePtGroupSession(session.id);
              navigate(back);
            } catch (e) {
              setActionError(e);
            }
          }}
        >
          Delete session
        </button>
      </div>

      {timerBlock && (
        <BlockTimer
          block={timerBlock}
          onClose={() => setTimerBlock(null)}
          onFinish={(result) => {
            setPrefill((pf) => ({ ...pf, [timerBlock.id]: result }));
            setTimerBlock(null);
          }}
        />
      )}
      {picking && workout && (
        <ExercisePicker
          exercises={data.exercises}
          onClose={() => setPicking(false)}
          onCreated={(ex) => setData((d) => ({ ...d, exercises: [...d.exercises, ex] }))}
          onPick={async (ex) => {
            setPicking(false);
            try {
              const w = await addExerciseToWorkout(workout, ex);
              setData((d) => ({ ...d, workouts: d.workouts.map((x) => (x.id === w.id ? w : x)) }));
            } catch (e) {
              setActionError(e);
            }
          }}
        />
      )}
      {people && (
        <PeopleModal
          data={data}
          onClose={() => setPeople(false)}
          onAdded={() => reload()}
          onRemoved={(pid) => setData((d) => ({ ...d, people: d.people.filter((x) => x.id !== pid) }))}
        />
      )}
    </div>
  );
}
