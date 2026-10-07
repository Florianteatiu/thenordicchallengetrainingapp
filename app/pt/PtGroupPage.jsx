import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Pencil, Play, Plus } from "lucide-react";
import { deletePtGroup, getPtGroup, listWorkoutTemplates, savePtGroup, setPtGroupMembers, startPtGroupSession } from "../lib/api";
import { formatDate, todayISO } from "../lib/dates";
import { Avatar, CommitInput, ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";
import { MemberPicker } from "./PtGroupsPage";

function EditMembersModal({ group, onClose, onSaved }) {
  const [members, setMembers] = useState(group.members.map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setBusy(true);
    try {
      await setPtGroupMembers(group.id, members);
      onSaved();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Members"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <MemberPicker selected={members} onChange={setMembers} />
      <p className="tiny faint mt-12">Taking someone out of the group never deletes their history.</p>
      <ErrorBox error={error} />
    </Modal>
  );
}

function TemplateSelect({ value, onChange, templates }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Empty: build it as you go</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
    </select>
  );
}

// Date, who's here, and the workout (or two: A and B).
function StartModal({ group, onClose }) {
  const navigate = useNavigate();
  const templates = useAsync(listWorkoutTemplates, []);
  const [date, setDate] = useState(todayISO());
  const [present, setPresent] = useState(group.members.map((m) => m.id));
  const [workoutA, setWorkoutA] = useState("");
  const [twoWorkouts, setTwoWorkouts] = useState(false);
  const [workoutB, setWorkoutB] = useState("");
  const [onB, setOnB] = useState([]); // client ids doing workout B
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const togglePresent = (id) => setPresent((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleB = (id) => setOnB((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));

  async function start() {
    if (!present.length) return setError("Tick at least one person.");
    const b = twoWorkouts ? present.filter((id) => onB.includes(id)) : [];
    const a = present.filter((id) => !b.includes(id));
    if (twoWorkouts && (!a.length || !b.length)) return setError("With two workouts, put at least one person on each (tap B next to their name).");
    setBusy(true);
    setError(null);
    try {
      const options = [{ fromWorkoutId: workoutA || null, clientIds: a }];
      if (twoWorkouts) options.push({ fromWorkoutId: workoutB || null, clientIds: b });
      const gs = await startPtGroupSession({ group, date, options });
      navigate(`/pt/group-sessions/${gs.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const list = templates.data ?? [];
  return (
    <Modal
      title={`Session · ${group.name}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
          <Play size={17} fill="currentColor" /> {busy ? "Saving…" : date > todayISO() ? "Plan session" : "Start session"}
        </button>
      }
    >
      <div className="col gap-16">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          <span className="tiny faint" style={{ fontWeight: 400 }}>
            {date > todayISO() ? "Planning ahead: the session is saved for that day, ready to open when you train." : "Pick a later day to plan a session ahead."}
          </span>
        </label>

        <label className="field">
          <span>{twoWorkouts ? "Workout A" : "Workout"}</span>
          <TemplateSelect value={workoutA} onChange={setWorkoutA} templates={list} />
        </label>
        {twoWorkouts ? (
          <label className="field">
            <span>Workout B</span>
            <TemplateSelect value={workoutB} onChange={setWorkoutB} templates={list} />
          </label>
        ) : (
          <button type="button" className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => setTwoWorkouts(true)}>
            + Some people do a different workout
          </button>
        )}

        <div className="field">
          <span>{date > todayISO() ? "Who's coming?" : "Who's here?"}{twoWorkouts ? " Tap A / B for each person." : ""}</span>
          <div className="list">
            {group.members.map((m) => {
              const here = present.includes(m.id);
              const b = onB.includes(m.id);
              return (
                <div key={m.id} className={`card card-tight row${here ? " card-on" : ""}`}>
                  <button type="button" className="row grow" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }} onClick={() => togglePresent(m.id)}>
                    <span className={`check-dot${here ? " on" : ""}`} />
                    <span style={{ fontWeight: 600 }}>{m.full_name}</span>
                  </button>
                  {twoWorkouts && here && (
                    <div className="seg">
                      <button type="button" className={!b ? "on" : ""} onClick={() => b && toggleB(m.id)}>
                        A
                      </button>
                      <button type="button" className={b ? "on" : ""} onClick={() => !b && toggleB(m.id)}>
                        B
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {group.members.length === 0 && <div className="small faint">This group has no members yet.</div>}
        </div>
        <ErrorBox error={error || templates.error} />
      </div>
    </Modal>
  );
}

export default function PtGroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: group, loading, error, reload, setData } = useAsync(() => getPtGroup(id), [id]);
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading && !group) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  async function save(patch) {
    try {
      const g = await savePtGroup({ id, ...patch });
      setData((d) => ({ ...d, ...g }));
    } catch (e) {
      setActionError(e);
    }
  }

  const nameOf = Object.fromEntries(group.members.map((m) => [m.id, m.full_name]));

  return (
    <div>
      <Link to="/pt/groups" className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> Groups
      </Link>
      <CommitInput className="input input-bare h1" style={{ fontSize: 30 }} value={group.name} onCommit={(v) => v.trim() && save({ name: v.trim() })} />
      <CommitInput className="input input-bare small muted" value={group.notes ?? ""} placeholder="Notes: time, place, focus of the group…" onCommit={(v) => save({ notes: v.trim() || null })} />

      <button className="btn btn-primary btn-lg btn-block mt-16" onClick={() => setStarting(true)} disabled={group.members.length === 0}>
        <Play size={18} fill="currentColor" /> Start group session
      </button>
      <ErrorBox error={actionError} />

      <div className="section">
        <div className="section-title">
          <div className="eyebrow">Members ({group.members.length})</div>
          <button className="link-btn small row gap-4" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </button>
        </div>
        {group.members.length === 0 ? (
          <button className="btn btn-ghost btn-block" onClick={() => setEditing(true)}>
            <Plus size={16} /> Add members
          </button>
        ) : (
          <div className="list">
            {group.members.map((m) => (
              <Link key={m.id} to={`/pt/clients/${m.id}`} className="card card-tight card-link row">
                <Avatar name={m.full_name} size={34} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{m.full_name}</div>
                  {m.injuries && <div className="tiny red ellipsis">⚠ {m.injuries}</div>}
                </div>
                <ChevronRight size={16} className="faint" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="eyebrow mb-8">Sessions</div>
        {group.sessions.length === 0 ? (
          <div className="empty small">No sessions yet.</div>
        ) : (
          <div className="list">
            {group.sessions.map((s) => {
              const titles = [...new Set(s.sessions.map((p) => p.workout_title))].filter(Boolean);
              return (
                <Link key={s.id} to={`/pt/group-sessions/${s.id}`} className="card card-tight card-link row">
                  <div className="date-badge">
                    <div className="display">{formatDate(s.session_date, { day: "numeric" })}</div>
                    <div className="tiny">{formatDate(s.session_date, { month: "short" })}</div>
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }} className="ellipsis">
                      {titles.join(" + ") || "Session"}
                    </div>
                    <div className="small muted ellipsis">
                      {s.sessions.length} {s.sessions.length === 1 ? "person" : "people"} · {s.sessions.map((p) => (nameOf[p.client_id] ?? "").split(" ")[0]).filter(Boolean).join(", ")}
                    </div>
                  </div>
                  {!s.completed_at && (s.session_date > todayISO() ? <span className="pill pill-yellow">Planned</span> : <span className="pill">Open</span>)}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="row mt-24 gap-6">
        <button className="btn btn-ghost btn-sm" onClick={() => save({ archived: !group.archived })}>
          {group.archived ? "Restore group" : "Archive group"}
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={async () => {
            if (!window.confirm(`Delete the group “${group.name}”? Past sessions and everyone's history are kept.`)) return;
            try {
              await deletePtGroup(id);
              navigate("/pt/groups");
            } catch (e) {
              setActionError(e);
            }
          }}
        >
          Delete group
        </button>
      </div>

      {starting && <StartModal group={group} onClose={() => setStarting(false)} />}
      {editing && (
        <EditMembersModal
          group={group}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
