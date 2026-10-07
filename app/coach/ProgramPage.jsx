import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Copy, Play, Plus, Search, Trash2, X } from "lucide-react";
import {
  activateProgram,
  addBlankWorkoutToDay,
  addTemplateToDay,
  copyProgram,
  copyWeek,
  getProfile,
  getProgram,
  listSessions,
  listWorkoutTemplates,
  moveProgramDay,
  removeProgramDay,
  removeWeek,
  updateProgram,
} from "../lib/api";
import { DAY_SHORT, formatDate, programDayDate, todayISO } from "../lib/dates";
import { formatEstimate, formatLabel } from "../lib/format";
import { dayStatus, sessionsByDay } from "../lib/gamify";
import { CommitInput, ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

// Move a workout to another day (works on a phone, unlike drag and drop).
// Optionally does the same for that weekday in every later week, which is
// what a client schedule change usually means.
function MoveModal({ program, dayRow, onClose, onMoved }) {
  const [day, setDay] = useState(dayRow.day);
  const [week, setWeek] = useState(dayRow.week);
  const later = program.days.filter((d) => d.day === dayRow.day && d.week > dayRow.week);
  const [allLater, setAllLater] = useState(later.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fromName = DAY_LONG[dayRow.day - 1];
  const unchanged = day === dayRow.day && week === dayRow.week;
  const targetDate = programDayDate(program.start_date, allLater ? dayRow.week : week, day);

  async function move() {
    setBusy(true);
    setError(null);
    try {
      if (allLater) {
        // Each week's workout stays in its own week; only the weekday changes.
        for (const d of [dayRow, ...later]) await moveProgramDay(d.id, d.week, day);
      } else {
        await moveProgramDay(dayRow.id, week, day);
      }
      onMoved();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Move workout"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={move} disabled={busy || unchanged}>
            {busy ? "Moving…" : "Move"}
          </button>
        </>
      }
    >
      <div className="col gap-16">
        <div className="small muted">
          <b style={{ color: "var(--text)" }}>{dayRow.workout?.title}</b> · Week {dayRow.week}, {fromName}
        </div>
        <div className="field">
          <span>Move to</span>
          <div className="chips">
            {DAY_SHORT.map((label, i) => (
              <button key={label} type="button" className={`chip${day === i + 1 ? " active" : ""}`} onClick={() => setDay(i + 1)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {later.length > 0 && (
          <label className="row small" style={{ cursor: "pointer", alignItems: "flex-start" }}>
            <input type="checkbox" checked={allLater} onChange={(e) => setAllLater(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Also move the {fromName} workouts in the later weeks (weeks {dayRow.week + 1}–{program.weeks}) to {DAY_LONG[day - 1]}
            </span>
          </label>
        )}
        {!allLater && program.weeks > 1 && (
          <label className="field" style={{ maxWidth: 200 }}>
            <span>Week</span>
            <select className="select" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
        )}
        {targetDate && !unchanged && (
          <div className="tiny faint">
            {allLater && later.length ? "First one lands on " : "Lands on "}
            {formatDate(targetDate, { weekday: "long", day: "numeric", month: "long" })}. The client sees the change next time they open the app.
          </div>
        )}
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function AddWorkoutModal({ programId, week, day, onClose, onAdded }) {
  const navigate = useNavigate();
  const templates = useAsync(listWorkoutTemplates, []);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const filtered = (templates.data ?? []).filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  async function blank() {
    setBusy(true);
    try {
      const w = await addBlankWorkoutToDay(programId, week, day);
      navigate(`/coach/workouts/${w.id}?back=/coach/programs/${programId}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  async function fromTemplate(t) {
    setBusy(true);
    try {
      await addTemplateToDay(programId, week, day, t.id);
      onAdded();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Week ${week} · ${DAY_SHORT[day - 1]}`} onClose={onClose}>
      <button className="btn btn-primary btn-block" onClick={blank} disabled={busy}>
        <Plus size={17} /> Build a new workout
      </button>
      <div className="eyebrow mt-24 mb-8">Or copy one of your workout templates</div>
      <div className="row mb-12" style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={error || templates.error} />
      <div className="list">
        {filtered.map((t) => (
          <button key={t.id} className="card card-tight card-link" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => fromTemplate(t)} disabled={busy}>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div className="tiny muted">
              {t.exerciseCount} {t.exerciseCount === 1 ? "exercise" : "exercises"} · {t.formats.map(formatLabel).join(", ") || "empty"}
              {t.estimateSec ? ` · ${formatEstimate(t.estimateSec)}` : ""}
            </div>
          </button>
        ))}
        {templates.data && filtered.length === 0 && <div className="small faint center">No workout templates{q ? " match" : " yet"}.</div>}
      </div>
    </Modal>
  );
}

function CopyWeekModal({ program, fromWeek, onClose, onCopied }) {
  const [target, setTarget] = useState(Math.min(fromWeek + 1, program.weeks + 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const options = Array.from({ length: program.weeks + 1 }, (_, i) => i + 1).filter((w) => w !== fromWeek);

  async function submit() {
    setBusy(true);
    try {
      await copyWeek(program.id, fromWeek, target);
      onCopied();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Copy week ${fromWeek}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Copying…" : "Copy"}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Copy all workouts into</span>
        <select className="select" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {options.map((w) => (
            <option key={w} value={w}>
              Week {w}
              {w > program.weeks ? " (new week)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">Each workout is copied, so you can progress the new week (more weight, more reps) without touching this one.</p>
      <ErrorBox error={error} />
    </Modal>
  );
}

export default function ProgramPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(null); // {week, day}
  const [moving, setMoving] = useState(null); // program day row
  const [copying, setCopying] = useState(null); // week
  const [dragId, setDragId] = useState(null);
  const [dropCell, setDropCell] = useState(null);
  const [actionError, setActionError] = useState(null);
  const today = todayISO();

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const program = await getProgram(id);
    const [client, sessions] = program.client_id
      ? await Promise.all([getProfile(program.client_id), listSessions(program.client_id)])
      : [null, []];
    return { program, client, sessions };
  }, [id]);

  const byCell = useMemo(() => {
    const map = {};
    for (const d of data?.program.days ?? []) (map[`${d.week}-${d.day}`] ??= []).push(d);
    return map;
  }, [data]);

  const sessionMap = useMemo(() => sessionsByDay(data?.sessions ?? []), [data]);

  async function run(fn) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  async function saveMeta(patch) {
    try {
      const updated = await updateProgram(id, patch);
      setData((d) => ({ ...d, program: { ...d.program, ...updated } }));
      if ("start_date" in patch) reload();
    } catch (e) {
      setActionError(e);
    }
  }

  function onDrop(week, day) {
    const dayRow = data.program.days.find((d) => d.id === dragId);
    setDropCell(null);
    setDragId(null);
    if (!dayRow || (dayRow.week === week && dayRow.day === day)) return;
    // Optimistic move, then persist.
    setData((d) => ({
      ...d,
      program: {
        ...d.program,
        days: d.program.days.map((x) => (x.id === dayRow.id ? { ...x, week, day, date: programDayDate(d.program.start_date, week, day) } : x)),
      },
    }));
    moveProgramDay(dayRow.id, week, day).catch((e) => {
      setActionError(e);
      reload();
    });
  }

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { program, client } = data;
  const back = program.client_id ? `/coach/clients/${program.client_id}` : "/coach/programs";

  return (
    <div>
      <Link to={back} className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> {client ? client.full_name : "Program templates"}
      </Link>

      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div className="grow" style={{ minWidth: 260 }}>
          <div className="row wrap gap-6 mb-8">
            {program.is_template ? <span className="pill pill-blue">Template</span> : <span className={`pill ${program.status === "active" ? "pill-green" : program.status === "draft" ? "pill-yellow" : ""}`}>{program.status}</span>}
            {client && <span className="pill">{client.full_name}</span>}
          </div>
          <CommitInput className="input input-bare h1" style={{ fontSize: 30 }} value={program.title} onCommit={(v) => saveMeta({ title: v || "Untitled program" })} />
          <CommitInput className="input input-bare small muted" value={program.description ?? ""} placeholder="Add a short description (goal, level, equipment)…" onCommit={(v) => saveMeta({ description: v || null })} />
        </div>
        <div className="row wrap gap-6">
          {!program.is_template && (
            <label className="field" style={{ minWidth: 160 }}>
              <span>Start date</span>
              <input className="input input-sm" type="date" value={program.start_date ?? ""} onChange={(e) => saveMeta({ start_date: e.target.value || null })} />
            </label>
          )}
          {!program.is_template && program.status !== "active" && (
            <button className="btn btn-primary btn-sm" onClick={() => run(() => activateProgram(program.id))}>
              <Play size={14} /> Make active
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              run(async () => {
                const newId = await copyProgram({ programId: program.id, asTemplate: true });
                navigate(`/coach/programs/${newId}`);
              })
            }
          >
            <Copy size={14} /> {program.is_template ? "Duplicate" : "Save as template"}
          </button>
        </div>
      </div>

      {!program.is_template && program.status === "draft" && (
        <div className="ok-box mb-12" style={{ background: "var(--yellow-soft)", color: "var(--yellow)" }}>
          Draft: {client?.full_name?.split(" ")[0] || "the client"} can't see this program until you make it active.
        </div>
      )}
      <ErrorBox error={actionError} />

      <div className="program-scroll mt-12">
        <div className="program-grid">
          <div />
          {DAY_SHORT.map((d) => (
            <div key={d} className="pg-head">
              {d}
            </div>
          ))}
          {Array.from({ length: program.weeks }, (_, wi) => wi + 1).map((week) => (
            <WeekRow
              key={week}
              week={week}
              program={program}
              byCell={byCell}
              sessionMap={sessionMap}
              today={today}
              dropCell={dropCell}
              setDropCell={setDropCell}
              onDrop={onDrop}
              setDragId={setDragId}
              onAdd={(day) => setAdding({ week, day })}
              onOpen={(d) => navigate(`/coach/workouts/${d.workout_id}?back=/coach/programs/${program.id}`)}
              onRemove={(d) => window.confirm(`Remove "${d.workout?.title}" from this day?`) && run(() => removeProgramDay(d.id))}
              onMove={(d) => setMoving(d)}
              onCopyWeek={() => setCopying(week)}
              onRemoveWeek={() =>
                window.confirm(`Delete week ${week} and all its workouts? Later weeks move up.`) && run(() => removeWeek(program.id, week, program.weeks))
              }
            />
          ))}
        </div>
      </div>
      <div className="row mt-12">
        <button className="btn btn-ghost btn-sm" onClick={() => saveMeta({ weeks: program.weeks + 1 })} disabled={program.weeks >= 52}>
          <Plus size={15} /> Add week
        </button>
        <span className="tiny faint">Tip: tap the calendar icon on a workout to move it to another day (or drag it on a computer).</span>
      </div>

      {adding && <AddWorkoutModal programId={program.id} week={adding.week} day={adding.day} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); reload(); }} />}
      {moving && (
        <MoveModal
          program={program}
          dayRow={moving}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setMoving(null);
            reload();
          }}
        />
      )}
      {copying && <CopyWeekModal program={program} fromWeek={copying} onClose={() => setCopying(null)} onCopied={() => { setCopying(null); reload(); }} />}
    </div>
  );
}

function WeekRow({ week, program, byCell, sessionMap, today, dropCell, setDropCell, onDrop, setDragId, onAdd, onOpen, onRemove, onMove, onCopyWeek, onRemoveWeek }) {
  return (
    <>
      <div className="pg-week">
        W{week}
        <div className="row gap-4">
          <button className="icon-btn" style={{ width: 26, height: 26 }} title={`Copy week ${week}`} onClick={onCopyWeek}>
            <Copy size={13} />
          </button>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title={`Delete week ${week}`} onClick={onRemoveWeek} disabled={program.weeks <= 1}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {Array.from({ length: 7 }, (_, di) => di + 1).map((day) => {
        const key = `${week}-${day}`;
        const date = programDayDate(program.start_date, week, day);
        return (
          <div
            key={key}
            className={`pg-cell${dropCell === key ? " drop" : ""}${date === today ? " is-today" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropCell(key);
            }}
            onDragLeave={() => setDropCell((c) => (c === key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(week, day);
            }}
          >
            {date && <div className="pg-date">{formatDate(date, { day: "numeric", month: "short" })}</div>}
            {(byCell[key] ?? []).map((d) => {
              const status = program.client_id ? dayStatus(d, sessionMap, today) : "planned";
              return (
                <div
                  key={d.id}
                  className={`pg-workout ${status}`}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDropCell(null)}
                  onClick={() => onOpen(d)}
                  title={status === "done" ? "Completed" : status === "missed" ? "Missed" : "Open workout"}
                >
                  <span className="grow">
                    {d.workout?.title}
                    <div className="tiny faint" style={{ fontWeight: 500 }}>
                      {d.exerciseCount} ex{d.estimateSec ? ` · ${formatEstimate(d.estimateSec).replace("≈ ", "~")}` : ""}{d.formats.some((f) => f !== "sets") ? ` · ${d.formats.filter((f) => f !== "sets").map(formatLabel).join(", ")}` : ""}
                    </div>
                  </span>
                  <div className="col" style={{ gap: 2 }}>
                    <button
                      className="icon-btn"
                      style={{ width: 22, height: 22 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(d);
                      }}
                      aria-label="Move to another day"
                      title="Move to another day"
                    >
                      <CalendarClock size={13} />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ width: 22, height: 22 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(d);
                      }}
                      aria-label="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button className="pg-add" onClick={() => onAdd(day)} aria-label="Add workout">
              <Plus size={14} />
            </button>
          </div>
        );
      })}
    </>
  );
}
