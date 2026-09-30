import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Check, Copy, KeyRound, Play, Trash2 } from "lucide-react";
import {
  activateProgram,
  copyProgram,
  createProgram,
  deleteProgram,
  getProfile,
  listClientPrograms,
  listProgramTemplates,
  listSessions,
  resetClientPassword,
  updateProfile,
} from "../lib/api";
import { formatDate, formatDateTime, nextMonday } from "../lib/dates";
import { Avatar, CommitInput, ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";
import SessionDetailModal, { FEELINGS } from "../components/SessionDetail";
import { useAuth } from "../auth/AuthProvider";
import Chat from "../components/Chat";
import JourneyView from "../components/JourneyView";
import LiftProgress from "../components/LiftProgress";
import { ClientCheckins } from "./InboxPage";

const STATUS_TONE = { active: "pill-green", draft: "pill-yellow", completed: "" };

const WORDS = ["Fjord", "Moose", "Birch", "Frost", "Pine", "Island", "Summit", "Trail", "North", "Lake", "Storm", "Aurora"];

// Easy to read out or type: e.g. "Moose-Fjord-4827".
function temporaryPassword() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${1000 + (r[2] % 9000)}`;
}

function ResetPasswordModal({ client, onClose }) {
  const [password, setPassword] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const first = client.full_name.split(" ")[0];
  const message = password
    ? `Hi ${first}! Here's a temporary password for the Nordic Challenge app: ${password}\n\nSign in with your usual email and this password, and the app will ask you to choose a new one. All your workouts and progress are still there.`
    : "";

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const pw = temporaryPassword();
      await resetClientPassword(client.id, pw);
      setPassword(pw);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy automatically. Select the message and copy it by hand.");
    }
  }

  return (
    <Modal title="Reset password" onClose={onClose}>
      {!password ? (
        <div className="col gap-16">
          <p className="muted" style={{ margin: 0 }}>
            {first} gets a temporary password from you. When they sign in with it, the app asks them to choose their own. Their workouts, messages
            and progress are not affected.
          </p>
          <p className="small faint" style={{ margin: 0 }}>
            Their old password stops working straight away, and they're signed out on any phone that's still logged in.
          </p>
          <ErrorBox error={error} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={reset} disabled={busy}>
              <KeyRound size={16} /> {busy ? "Resetting…" : "Create temporary password"}
            </button>
          </div>
        </div>
      ) : (
        <div className="col gap-16">
          <div className="ok-box">Done! Send this to {first}:</div>
          <div className="card center">
            <div className="eyebrow">Temporary password</div>
            <div className="display yellow mt-8" style={{ fontSize: 30, textTransform: "none", userSelect: "all" }}>
              {password}
            </div>
          </div>
          <div className="card card-tight small" style={{ whiteSpace: "pre-wrap", userSelect: "all" }}>
            {message}
          </div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied!" : "Copy message"}
          </button>
          <p className="tiny faint center" style={{ margin: 0 }}>
            This password is only shown now. If you lose it, just reset again.
          </p>
        </div>
      )}
    </Modal>
  );
}

function AssignModal({ clientId, onClose, onDone }) {
  const templates = useAsync(listProgramTemplates, []);
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState(nextMonday());
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let programId;
      if (templateId) programId = await copyProgram({ programId: templateId, clientId, startDate });
      else programId = (await createProgram({ clientId, startDate, title: "New program" })).id;
      if (activate) await activateProgram(programId);
      onDone(programId);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New program"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : templateId ? "Assign template" : "Create blank program"}
          </button>
        </>
      }
    >
      <div className="col gap-16">
        <label className="field">
          <span>Start from</span>
          <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Blank program</option>
            {(templates.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.weeks} wk · {t.program_days.length} workouts
              </option>
            ))}
          </select>
        </label>
        {templateId && <div className="small muted">The template is copied, so you can tweak this client's version without changing the template.</div>}
        <label className="field">
          <span>Start date (week 1 starts on that week's Monday)</span>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="row small" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          Make it the active program now (the client sees it straight away)
        </label>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function ClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile: me } = useAuth();
  const [tab, setTab] = useState("programs");
  const [assigning, setAssigning] = useState(false);
  const [openSession, setOpenSession] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [client, programs, sessions] = await Promise.all([getProfile(id), listClientPrograms(id), listSessions(id, { limit: 100 })]);
    return { client, programs, sessions };
  }, [id]);

  async function saveField(field, value) {
    try {
      const client = await updateProfile(id, { [field]: value });
      setData((d) => ({ ...d, client }));
    } catch (e) {
      setActionError(e);
    }
  }

  async function run(fn) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { client, programs, sessions } = data;
  const completed = sessions.filter((s) => s.completed_at);

  return (
    <div>
      <Link to="/coach" className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> Clients
      </Link>
      <div className="page-head">
        <div className="row gap-16">
          <Avatar name={client.full_name} url={client.avatar_url} size={64} />
          <div>
            <h1 className="h1">{client.full_name}</h1>
            <div className="small muted mt-4">
              {completed.length} workouts completed · joined {formatDateTime(client.created_at)}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setAssigning(true)}>
          <CalendarPlus size={17} /> New program
        </button>
      </div>

      <ErrorBox error={actionError} />

      <div className="tabs">
        {[
          ["programs", "Programs"],
          ["history", `Workouts (${sessions.length})`],
          ["chat", "Chat"],
          ["checkins", "Check-ins"],
          ["lifts", "Lifts"],
          ["journey", "Cross Sweden"],
          ["profile", "Profile & notes"],
        ].map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "programs" &&
        (programs.length === 0 ? (
          <div className="empty">
            <div className="h3">No program yet</div>
            <p className="small">Assign one of your templates or build a program from scratch.</p>
            <button className="btn btn-primary mt-8" onClick={() => setAssigning(true)}>
              <CalendarPlus size={17} /> New program
            </button>
          </div>
        ) : (
          <div className="list">
            {programs.map((p) => (
              <div key={p.id} className="card row wrap between">
                <Link to={`/coach/programs/${p.id}`} className="grow">
                  <div className="row wrap">
                    <span className="h3">{p.title}</span>
                    <span className={`pill ${STATUS_TONE[p.status]}`}>{p.status}</span>
                  </div>
                  <div className="small muted mt-4">
                    {p.weeks} weeks · {p.program_days.length} workouts{p.start_date ? ` · starts ${formatDate(p.start_date)}` : ""}
                  </div>
                </Link>
                <div className="row gap-6">
                  <Link className="btn btn-sm" to={`/coach/programs/${p.id}`}>
                    Open
                  </Link>
                  {p.status !== "active" && (
                    <button className="btn btn-sm btn-ghost" onClick={() => run(() => activateProgram(p.id))}>
                      <Play size={14} /> Make active
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    title="Save as template"
                    onClick={() => run(() => copyProgram({ programId: p.id, asTemplate: true }))}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete program"
                    onClick={() => window.confirm(`Delete "${p.title}"? Logged workouts are kept in the history.`) && run(() => deleteProgram(p.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "history" &&
        (sessions.length === 0 ? (
          <div className="empty">No workouts logged yet.</div>
        ) : (
          <div className="list">
            {sessions.map((s) => (
              <button key={s.id} className="card card-link row between" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpenSession(s.id)}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{s.workout_title}</div>
                  <div className="small muted">
                    {s.completed_at ? formatDateTime(s.completed_at) : `Started ${formatDateTime(s.started_at)}`}
                    {s.notes ? ` · “${s.notes}”` : ""}
                  </div>
                </div>
                <div className="row gap-6">
                  {s.feeling && <span style={{ fontSize: 20 }}>{FEELINGS[s.feeling - 1]}</span>}
                  {s.rpe && <span className="pill pill-yellow">RPE {s.rpe}</span>}
                  {!s.completed_at && <span className="pill">In progress</span>}
                </div>
              </button>
            ))}
          </div>
        ))}

      {tab === "chat" && <Chat clientId={id} me={me} other={client} className="chat-embedded" emptyText={`No messages with ${client.full_name} yet.`} />}
      {tab === "checkins" && <ClientCheckins clientId={id} />}
      {tab === "lifts" && <LiftProgress clientId={id} />}
      {tab === "journey" && <JourneyView clientId={id} />}

      {tab === "profile" && (
        <div className="col gap-16" style={{ maxWidth: 640 }}>
          <label className="field">
            <span>Name</span>
            <CommitInput value={client.full_name} onCommit={(v) => saveField("full_name", v)} />
          </label>
          <label className="field">
            <span>Goals</span>
            <CommitInput multiline value={client.goals} onCommit={(v) => saveField("goals", v)} placeholder="e.g. First pull-up, run 10 km under 55 min" />
          </label>
          <label className="field">
            <span>Injuries & limitations</span>
            <CommitInput multiline value={client.injuries} onCommit={(v) => saveField("injuries", v)} />
          </label>
          <label className="field">
            <span>Equipment available</span>
            <CommitInput multiline value={client.equipment} onCommit={(v) => saveField("equipment", v)} placeholder="e.g. Full gym, or dumbbells + bands at home" />
          </label>
          <label className="field" style={{ maxWidth: 200 }}>
            <span>Weekly target (workouts)</span>
            <CommitInput type="number" min={1} max={14} value={String(client.weekly_target)} onCommit={(v) => saveField("weekly_target", Number(v) || 3)} />
          </label>
          <div className="small faint">The client can see and edit their own goals, injuries and equipment in their Me tab.</div>
          <div className="card mt-8">
            <div className="h3">Login</div>
            <div className="small muted mt-4">
              Forgot their password? Create a temporary one and send it to them.
              {client.must_change_password && " (A temporary password is active and hasn't been changed yet.)"}
            </div>
            <button className="btn btn-ghost btn-sm mt-12" onClick={() => setResetting(true)}>
              <KeyRound size={15} /> Reset password
            </button>
          </div>
          <div className="row mt-8">
            <button className="btn btn-ghost btn-sm" onClick={() => saveField("archived", !client.archived)}>
              {client.archived ? "Restore client" : "Archive client"}
            </button>
          </div>
        </div>
      )}

      {assigning && (
        <AssignModal
          clientId={id}
          onClose={() => setAssigning(false)}
          onDone={(programId) => navigate(`/coach/programs/${programId}`)}
        />
      )}
      {openSession && <SessionDetailModal sessionId={openSession} onClose={() => setOpenSession(null)} />}
      {resetting && (
        <ResetPasswordModal
          client={client}
          onClose={() => {
            setResetting(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
