import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Video } from "lucide-react";
import { deleteExercise, listExercises, saveExercise } from "../lib/api";
import { CATEGORIES, TRACKING, categoryLabel } from "../lib/format";
import { ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

function ExerciseModal({ exercise, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ name: "", category: "strength", tracking: "weight_reps", video_url: "", cues: "", ...exercise });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.name.trim()) return setError("Give the exercise a name.");
    setBusy(true);
    setError(null);
    try {
      const { id, name, category, tracking, video_url, cues } = form;
      const saved = await saveExercise({ id, name: name.trim(), category, tracking, video_url: video_url?.trim() || null, cues: cues?.trim() || null });
      onSaved(saved);
    } catch (e) {
      setError(e.code === "23505" ? "An exercise with that name already exists." : e);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${form.name}" from your library?`)) return;
    setBusy(true);
    try {
      await deleteExercise(form.id);
      onDeleted(form.id);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={form.id ? "Edit exercise" : "New exercise"}
      onClose={onClose}
      footer={
        <>
          {form.id && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <div className="col gap-16">
        <label className="field">
          <span>Name</span>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Category</span>
            <select className="select" value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Client logs</span>
            <select className="select" value={form.tracking} onChange={(e) => set({ tracking: e.target.value })}>
              {TRACKING.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Demo video link (YouTube, Instagram, Vimeo…)</span>
          <input className="input" value={form.video_url ?? ""} onChange={(e) => set({ video_url: e.target.value })} placeholder="https://" />
        </label>
        <label className="field">
          <span>Coaching cues</span>
          <textarea className="textarea" value={form.cues ?? ""} onChange={(e) => set({ cues: e.target.value })} placeholder="What the client should focus on" />
        </label>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function LibraryPage() {
  const { data, loading, error, reload, setData } = useAsync(listExercises, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);

  const list = useMemo(
    () => (data ?? []).filter((e) => (cat === "all" || e.category === cat) && e.name.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q, cat],
  );

  if (loading && !data) return <PageLoader />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Library</div>
          <h1 className="h1 mt-4">Exercises</h1>
          <p className="muted small mt-8">Add a demo video and cues once; they show up for every client who gets that exercise.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={17} /> New exercise
        </button>
      </div>
      <ErrorBox error={error} onRetry={reload} />

      <div className="row wrap mb-16">
        <div className="row" style={{ position: "relative", width: 280 }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          <button className={`chip${cat === "all" ? " active" : ""}`} onClick={() => setCat("all")}>
            All ({data?.length ?? 0})
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip${cat === c.id ? " active" : ""}`} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Exercise</th>
              <th>Category</th>
              <th>Logs</th>
              <th>Video</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => setEditing(e)}>
                <td>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  {e.cues && <div className="tiny faint ellipsis" style={{ maxWidth: 380 }}>{e.cues}</div>}
                </td>
                <td><span className="pill">{categoryLabel(e.category)}</span></td>
                <td className="small muted nowrap">{TRACKING.find((t) => t.id === e.tracking)?.label}</td>
                <td>{e.video_url ? <Video size={16} className="yellow" /> : <span className="faint tiny">–</span>}</td>
                <td><Pencil size={15} className="faint" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty" style={{ border: "none" }}>No exercises found.</div>}
      </div>

      {editing && (
        <ExerciseModal
          exercise={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((list) => [...list.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
            setEditing(null);
          }}
          onDeleted={(id) => {
            setData((list) => list.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
