import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Upload, Video } from "lucide-react";
import { deleteExercise, listExercises, saveExercise, uploadExerciseVideo } from "../lib/api";
import VideoEmbed from "../components/VideoEmbed";
import { CATEGORIES, TRACKING, categoryLabel } from "../lib/format";
import { ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

function ExerciseModal({ exercise, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ name: "", category: "strength", tracking: "weight_reps", video_url: "", cues: "", journey_kind: null, ...exercise });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.name.trim()) return setError("Give the exercise a name.");
    setBusy(true);
    setError(null);
    try {
      const { id, name, category, tracking, video_url, cues, journey_kind } = form;
      const saved = await saveExercise({
        id,
        name: name.trim(),
        category,
        tracking,
        video_url: video_url?.trim() || null,
        cues: cues?.trim() || null,
        journey_kind: tracking === "distance_time" ? journey_kind || null : null,
      });
      onSaved(saved);
    } catch (e) {
      setError(e.code === "23505" ? "An exercise with that name already exists." : e);
      setBusy(false);
    }
  }

  async function onVideo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) return setError("That video is over 200 MB. Trim it or export at a lower quality.");
    setUploading(true);
    setError(null);
    try {
      set({ video_url: await uploadExerciseVideo(form.id ?? `new-${Date.now()}`, file) });
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
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
          <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>
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
        {form.tracking === "distance_time" && (
          <label className="field">
            <span>Counts on the Cross Sweden map as</span>
            <select className="select" value={form.journey_kind ?? ""} onChange={(e) => set({ journey_kind: e.target.value || null })}>
              <option value="">Doesn't count</option>
              <option value="run">Running</option>
              <option value="bike">Cycling</option>
              <option value="swim">Swimming</option>
            </select>
          </label>
        )}
        <div className="field">
          <span>Demo video</span>
          {form.video_url && <VideoEmbed url={form.video_url} />}
          <div className="row gap-6">
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", flexShrink: 0 }}>
              <Upload size={15} /> {uploading ? "Uploading…" : form.video_url ? "Replace video" : "Upload video"}
              <input type="file" accept="video/*" hidden onChange={onVideo} disabled={uploading} />
            </label>
            <input className="input grow" value={form.video_url ?? ""} onChange={(e) => set({ video_url: e.target.value })} placeholder="…or paste a YouTube / Vimeo link" />
          </div>
        </div>
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
