import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Dumbbell, Pin, PinOff, Play, Repeat, Trash2 } from "lucide-react";
import {
  addPtNote,
  createPtSession,
  deletePtClient,
  deletePtNote,
  getPtClient,
  listPtNotes,
  listPtSessions,
  listPtWeightedSets,
  listWorkoutTemplates,
  savePtClient,
  updatePtNote,
} from "../lib/api";
import { formatDate, formatDateTime, todayISO } from "../lib/dates";
import { Avatar, CommitInput, ErrorBox, Modal, PageLoader, Spinner, useAsync } from "../components/ui";
import LiftProgress from "../components/LiftProgress";

const sessionTitle = (s) => s.workout?.title || s.workout_title || "Session";

function StartSessionModal({ client, lastSession, onClose }) {
  const navigate = useNavigate();
  const templates = useAsync(listWorkoutTemplates, []);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function start(fromWorkoutId) {
    setBusy(true);
    setError(null);
    try {
      const s = await createPtSession({ clientId: client.id, date, fromWorkoutId });
      navigate(`/pt/sessions/${s.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const option = (key, icon, title, sub, onClick) => (
    <button key={key} className="card card-tight card-link row" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} disabled={busy} onClick={onClick}>
      {icon}
      <div className="grow">
        <div style={{ fontWeight: 700 }}>{title}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      <ChevronRight size={18} className="faint" />
    </button>
  );

  return (
    <Modal title={`Session with ${client.full_name.split(" ")[0]}`} onClose={onClose}>
      <div className="col gap-12">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          <span className="tiny faint" style={{ fontWeight: 400 }}>
            {date > todayISO() ? "Planning ahead: the session is saved for that day, ready to open when you train." : "Pick a later day to plan a session ahead."}
          </span>
        </label>
        <ErrorBox error={error} />
        {lastSession?.workout_id &&
          option("repeat", <Repeat size={20} className="yellow" />, "Repeat last session", `${sessionTitle(lastSession)} · ${formatDate(lastSession.session_date)}`, () =>
            start(lastSession.workout_id),
          )}
        {option("empty", <Play size={20} className="yellow" />, "Empty session", "Add exercises as you go", () => start(null))}
        <div className="eyebrow mt-8">From a workout template</div>
        {templates.loading && <Spinner />}
        {templates.data?.length === 0 && <div className="small faint">No templates yet. Make them in the Workouts tab.</div>}
        {(templates.data ?? []).map((t) =>
          option(t.id, <Dumbbell size={20} className="faint" />, t.title, `${t.exerciseCount} exercise${t.exerciseCount === 1 ? "" : "s"}`, () => start(t.id)),
        )}
      </div>
    </Modal>
  );
}

function Notes({ clientId, notes, setNotes }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
  }

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    await run(async () => {
      const n = await addPtNote(clientId, text);
      setNotes((list) => [n, ...list]);
      setText("");
    });
    setBusy(false);
  }

  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="col gap-12">
      <div className="col gap-6">
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Left knee sore today, swapped lunges for step-ups" />
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={add} disabled={busy || !text.trim()}>
          Save note
        </button>
      </div>
      <ErrorBox error={error} />
      {sorted.length === 0 && <div className="empty small">Notes you save here stay with this client, newest first. Pin the ones you always want to see.</div>}
      {sorted.map((n) => (
        <div key={n.id} className={`card card-tight${n.pinned ? " note-pinned" : ""}`}>
          <div className="row-top between">
            <div className="grow pre">{n.body}</div>
            <div className="row gap-4">
              <button
                className="icon-btn"
                title={n.pinned ? "Unpin" : "Pin to the top"}
                onClick={() => run(async () => {
                  const saved = await updatePtNote(n.id, { pinned: !n.pinned });
                  setNotes((list) => list.map((x) => (x.id === n.id ? saved : x)));
                })}
              >
                {n.pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </button>
              <button
                className="icon-btn"
                title="Delete note"
                onClick={() => window.confirm("Delete this note?") && run(async () => {
                  await deletePtNote(n.id);
                  setNotes((list) => list.filter((x) => x.id !== n.id));
                })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="tiny faint mt-4">{formatDateTime(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

export default function PtClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("sessions");
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [client, sessions, notes] = await Promise.all([getPtClient(id), listPtSessions(id), listPtNotes(id)]);
    return { client, sessions, notes };
  }, [id]);

  async function saveField(field, value) {
    setActionError(null);
    try {
      const client = await savePtClient({ id, [field]: typeof value === "string" ? value.trim() || null : value });
      setData((d) => ({ ...d, client }));
    } catch (e) {
      setActionError(e);
    }
  }

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { client, sessions, notes } = data;
  const pinned = notes.filter((n) => n.pinned);
  const setNotes = (fn) => setData((d) => ({ ...d, notes: fn(d.notes) }));

  return (
    <div>
      <Link to="/pt" className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> Clients
      </Link>
      <div className="row gap-16 mb-16">
        <Avatar name={client.full_name} size={60} />
        <div className="grow">
          <h1 className="h1">{client.full_name}</h1>
          <div className="small muted mt-4">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
            {sessions[0] && ` · last ${formatDate(sessions[0].session_date)}`}
            {client.archived && " · archived"}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-lg btn-block" onClick={() => setStarting(true)}>
        <Play size={18} fill="currentColor" /> Start session
      </button>

      {(client.goals || client.injuries || pinned.length > 0) && (
        <div className="col gap-6 mt-16">
          {client.goals && (
            <div className="small">
              <span className="eyebrow">Goals </span> {client.goals}
            </div>
          )}
          {client.injuries && (
            <div className="small">
              <span className="eyebrow red">Watch out </span> {client.injuries}
            </div>
          )}
          {pinned.map((n) => (
            <div key={n.id} className="card card-tight note-pinned small pre">
              <Pin size={12} className="yellow" /> {n.body}
            </div>
          ))}
        </div>
      )}

      <ErrorBox error={actionError} />

      <div className="tabs mt-16">
        {[
          ["sessions", `Sessions (${sessions.length})`],
          ["notes", `Notes (${notes.length})`],
          ["lifts", "Lifts"],
          ["profile", "Profile"],
        ].map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "sessions" &&
        (sessions.length === 0 ? (
          <div className="empty small">No sessions yet. Tap “Start session” when you begin training together.</div>
        ) : (
          <div className="list">
            {sessions.map((s) => (
              <Link key={s.id} to={`/pt/sessions/${s.id}`} className="card card-tight card-link row">
                <div className="date-badge">
                  <div className="display">{formatDate(s.session_date, { day: "numeric" })}</div>
                  <div className="tiny">{formatDate(s.session_date, { month: "short" })}</div>
                </div>
                <div className="grow">
                  <div style={{ fontWeight: 700 }} className="ellipsis">{sessionTitle(s)}</div>
                  <div className="small muted ellipsis">
                    {formatDate(s.session_date, { weekday: "long" })}
                    {s.group_session ? ` · Group: ${s.group_session.group_name}` : ""}
                    {s.notes ? ` · “${s.notes}”` : ""}
                  </div>
                </div>
                {s.rpe && <span className="pill pill-yellow">RPE {s.rpe}</span>}
                {!s.completed_at && (s.session_date > todayISO() ? <span className="pill pill-yellow">Planned</span> : <span className="pill">Open</span>)}
              </Link>
            ))}
          </div>
        ))}

      {tab === "notes" && <Notes clientId={id} notes={notes} setNotes={setNotes} />}

      {tab === "lifts" && <LiftProgress clientId={id} load={listPtWeightedSets} />}

      {tab === "profile" && (
        <div className="col gap-16">
          <label className="field">
            <span>Name</span>
            <CommitInput value={client.full_name} onCommit={(v) => v.trim() && saveField("full_name", v)} />
          </label>
          <label className="field">
            <span>Goals</span>
            <CommitInput multiline value={client.goals} onCommit={(v) => saveField("goals", v)} placeholder="e.g. Stronger back, first pull-up" />
          </label>
          <label className="field">
            <span>Injuries & limitations</span>
            <CommitInput multiline value={client.injuries} onCommit={(v) => saveField("injuries", v)} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Phone</span>
              <CommitInput type="tel" value={client.phone} onCommit={(v) => saveField("phone", v)} />
            </label>
            <label className="field">
              <span>Email</span>
              <CommitInput type="email" value={client.email} onCommit={(v) => saveField("email", v)} />
            </label>
          </div>
          <div className="row wrap mt-8">
            <button className="btn btn-ghost btn-sm" onClick={() => saveField("archived", !client.archived)}>
              {client.archived ? "Restore client" : "Archive client"}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (!window.confirm(`Delete ${client.full_name} and all their sessions and notes? This can't be undone. (Archiving keeps everything.)`)) return;
                try {
                  await deletePtClient(id);
                  navigate("/pt");
                } catch (e) {
                  setActionError(e);
                }
              }}
            >
              <Trash2 size={14} /> Delete client
            </button>
          </div>
        </div>
      )}

      {starting && <StartSessionModal client={client} lastSession={sessions[0]} onClose={() => setStarting(false)} />}
    </div>
  );
}
