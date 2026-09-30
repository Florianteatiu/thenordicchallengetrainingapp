import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Search, UsersRound } from "lucide-react";
import { listPtClients, listPtGroups, savePtClient, savePtGroup, setPtGroupMembers } from "../lib/api";
import { daysBetween, todayISO } from "../lib/dates";
import { ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

export const MAX_GROUP = 8;

function lastText(iso) {
  if (!iso) return "No sessions yet";
  const d = daysBetween(iso, todayISO());
  if (d === 0) return "Trained today";
  if (d === 1) return "Trained yesterday";
  return `Last trained ${d} days ago`;
}

// Tick who's in a group; add a brand-new client on the spot.
export function MemberPicker({ selected, onChange, max = MAX_GROUP }) {
  const clients = useAsync(listPtClients, []);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState(null);

  const list = useMemo(
    () => (clients.data ?? []).filter((c) => !c.archived && c.full_name.toLowerCase().includes(q.trim().toLowerCase())),
    [clients.data, q],
  );

  function toggle(id) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  async function addNew() {
    if (!newName.trim()) return;
    setError(null);
    try {
      const c = await savePtClient({ full_name: newName.trim() });
      clients.setData((d) => [...(d ?? []), { ...c, sessionCount: 0, lastSession: null }]);
      setNewName("");
      if (selected.length < max) onChange([...selected, c.id]);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="col gap-6">
      <div className="row between">
        <span className="small muted">
          {selected.length} of {max} max
        </span>
      </div>
      {(clients.data?.length ?? 0) > 6 && (
        <div className="row" style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      <div className="list" style={{ maxHeight: 300, overflowY: "auto" }}>
        {list.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className={`card card-tight row${on ? " card-on" : ""}`} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => toggle(c.id)}>
              <span className={`check-dot${on ? " on" : ""}`} />
              <span className="grow" style={{ fontWeight: 600 }}>
                {c.full_name}
              </span>
            </button>
          );
        })}
        {clients.data && list.length === 0 && <div className="small faint center">No clients found.</div>}
      </div>
      <div className="row">
        <input className="input grow" placeholder="Or add a new client: name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNew()} />
        <button type="button" className="btn btn-ghost" onClick={addNew} disabled={!newName.trim()}>
          <Plus size={16} /> Add
        </button>
      </div>
      <ErrorBox error={error || clients.error} />
    </div>
  );
}

function NewGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!name.trim()) return setError("Give the group a name, e.g. “Tuesday 7am”.");
    setBusy(true);
    setError(null);
    try {
      const g = await savePtGroup({ name: name.trim() });
      await setPtGroupMembers(g.id, members);
      onCreated(g);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New group"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Create group"}
        </button>
      }
    >
      <div className="col gap-16">
        <label className="field">
          <span>Group name</span>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuesday 7am" />
        </label>
        <div className="field">
          <span>Who's in it?</span>
          <MemberPicker selected={members} onChange={setMembers} />
        </div>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function PtGroupsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listPtGroups, []);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const archivedCount = data.filter((g) => g.archived).length;
  const list = data.filter((g) => g.archived === showArchived).sort((a, b) => (b.lastSession ?? "9999").localeCompare(a.lastSession ?? "9999") || a.name.localeCompare(b.name));

  return (
    <div>
      <div className="row between mb-16">
        <div>
          <div className="eyebrow">In person</div>
          <h1 className="h1 mt-4">{showArchived ? "Archived groups" : "Groups"}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={17} /> New group
        </button>
      </div>

      {data.length === 0 ? (
        <div className="empty">
          <UsersRound size={28} className="yellow" />
          <div className="h3 mt-8">No groups yet</div>
          <p className="small">Make a group for each small-group class (up to {MAX_GROUP} people). Everyone's numbers still go into their own history.</p>
          <button className="btn btn-primary mt-8" onClick={() => setAdding(true)}>
            <Plus size={17} /> Create your first group
          </button>
        </div>
      ) : (
        <div className="list">
          {list.map((g) => (
            <Link key={g.id} to={`/pt/groups/${g.id}`} className="card card-tight card-link row">
              <div className="avatar" style={{ width: 42, height: 42, background: "var(--yellow)", color: "var(--on-yellow)" }}>
                {g.members.length}
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="h3 ellipsis">{g.name}</div>
                <div className="small muted ellipsis">{g.members.map((m) => m.full_name.split(" ")[0]).join(", ") || "No members yet"}</div>
                <div className="tiny faint">{lastText(g.lastSession)}</div>
              </div>
              <ChevronRight size={18} className="faint" />
            </Link>
          ))}
        </div>
      )}

      {(archivedCount > 0 || showArchived) && (
        <button className="link-btn small mt-16" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? "← Back to active groups" : `Archived groups (${archivedCount})`}
        </button>
      )}

      {adding && <NewGroupModal onClose={() => setAdding(false)} onCreated={(g) => navigate(`/pt/groups/${g.id}`)} />}
    </div>
  );
}
