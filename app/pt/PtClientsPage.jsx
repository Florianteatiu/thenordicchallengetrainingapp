import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Search } from "lucide-react";
import { listPtClients, savePtClient } from "../lib/api";
import { daysBetween, todayISO } from "../lib/dates";
import { Avatar, ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

function sinceText(iso) {
  if (!iso) return "No sessions yet";
  const d = daysBetween(iso, todayISO());
  if (d < 0) return `Next session in ${-d} day${d === -1 ? "" : "s"}`;
  if (d === 0) return "Trained today";
  if (d === 1) return "Trained yesterday";
  return `Last trained ${d} days ago`;
}

function AddClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: "", goals: "", injuries: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.full_name.trim()) return setError("Add the client's name.");
    setBusy(true);
    setError(null);
    try {
      const fields = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      onCreated(await savePtClient(fields));
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New client"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Add client"}
        </button>
      }
    >
      <div className="col gap-12">
        <label className="field">
          <span>Name</span>
          <input className="input" autoFocus value={form.full_name} onChange={set("full_name")} placeholder="First and last name" />
        </label>
        <label className="field">
          <span>Goals</span>
          <textarea className="textarea" value={form.goals} onChange={set("goals")} placeholder="e.g. Stronger back, first pull-up, get ready for a race" />
        </label>
        <label className="field">
          <span>Injuries & limitations</span>
          <textarea className="textarea" value={form.injuries} onChange={set("injuries")} placeholder="e.g. Left knee, no deep lunges" />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input className="input" type="tel" value={form.phone} onChange={set("phone")} />
        </label>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function PtClientsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listPtClients, []);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const archivedCount = data.filter((c) => c.archived).length;
  const list = data
    .filter((c) => c.archived === showArchived && c.full_name.toLowerCase().includes(q.trim().toLowerCase()))
    // Most recently trained first; new clients (no sessions) on top so they're easy to find.
    .sort((a, b) => (b.lastSession ?? "9999").localeCompare(a.lastSession ?? "9999") || a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <div className="row between mb-16">
        <div>
          <div className="eyebrow">In person</div>
          <h1 className="h1 mt-4">{showArchived ? "Archived" : "Clients"}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={17} /> New client
        </button>
      </div>

      {data.length > 5 && (
        <div className="row mb-12" style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {data.length === 0 ? (
        <div className="empty">
          <div className="h3">No in-person clients yet</div>
          <p className="small">Add the people you train face to face. Then start a session and log it as you go.</p>
          <button className="btn btn-primary mt-8" onClick={() => setAdding(true)}>
            <Plus size={17} /> Add your first client
          </button>
        </div>
      ) : (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} to={`/pt/clients/${c.id}`} className="card card-tight card-link row">
              <Avatar name={c.full_name} size={42} />
              <div className="grow">
                <div className="h3 ellipsis">{c.full_name}</div>
                <div className="small muted">
                  {sinceText(c.lastSession)}
                  {c.sessionCount > 0 && ` · ${c.sessionCount} session${c.sessionCount === 1 ? "" : "s"}`}
                </div>
              </div>
              <ChevronRight size={18} className="faint" />
            </Link>
          ))}
          {list.length === 0 && <div className="small faint center mt-8">No one matches “{q}”.</div>}
        </div>
      )}

      {(archivedCount > 0 || showArchived) && (
        <button className="link-btn small mt-16" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? "← Back to active clients" : `Archived clients (${archivedCount})`}
        </button>
      )}

      {adding && <AddClientModal onClose={() => setAdding(false)} onCreated={(c) => navigate(`/pt/clients/${c.id}`)} />}
    </div>
  );
}
