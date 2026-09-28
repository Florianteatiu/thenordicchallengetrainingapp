import { useState } from "react";
import { Plus } from "lucide-react";
import { deleteEvent, listEvents, saveEvent } from "../lib/api";
import { todayISO } from "../lib/dates";
import { EVENT_KINDS, EventRow } from "../components/ChallengeCalendar";
import { ErrorBox, Modal, PageLoader, useAsync } from "../components/ui";

function EventModal({ event, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ title: "", kind: "event", starts_on: todayISO(), ends_on: "", location: "", description: "", url: "", ...event });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.title.trim()) return setError("Give it a title, e.g. “Swim leg: Gothenburg → Malmö”.");
    if (form.ends_on && form.ends_on < form.starts_on) return setError("The end date is before the start date.");
    let url = form.url?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await saveEvent({
          id: form.id,
          title: form.title.trim(),
          kind: form.kind,
          starts_on: form.starts_on,
          ends_on: form.ends_on || null,
          location: form.location?.trim() || null,
          description: form.description?.trim() || null,
          url,
        }),
      );
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${form.title}”?`)) return;
    setBusy(true);
    try {
      await deleteEvent(form.id);
      onDeleted(form.id);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={form.id ? "Edit date" : "Add a date"}
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
        <div className="segmented">
          {EVENT_KINDS.map((k) => (
            <button key={k.id} className={form.kind === k.id ? "active" : ""} onClick={() => set({ kind: k.id })}>
              <k.icon size={15} /> {k.label.replace(" leg", "")}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Title</span>
          <input className="input" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Documentary premiere" autoFocus />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Starts</span>
            <input className="input" type="date" value={form.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
          </label>
          <label className="field">
            <span>Ends (optional)</span>
            <input className="input" type="date" value={form.ends_on ?? ""} min={form.starts_on} onChange={(e) => set({ ends_on: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Where (optional)</span>
          <input className="input" value={form.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Gothenburg → Malmö, or Bio Rio, Stockholm" />
        </label>
        <label className="field">
          <span>Details (optional)</span>
          <textarea className="textarea" value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="What's happening, how to follow along or join…" />
        </label>
        <label className="field">
          <span>Link (optional)</span>
          <input className="input" value={form.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="e.g. tickets or the page on thenordicchallenge.se" />
        </label>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export default function EventsPage() {
  const { data, loading, error, reload, setData } = useAsync(listEvents, []);
  const [editing, setEditing] = useState(null);
  if (loading && !data) return <PageLoader />;
  const sort = (list) => [...list].sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Coach</div>
          <h1 className="h1 mt-4">Challenge calendar</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={17} /> Add a date
        </button>
      </div>
      <p className="small muted mb-16">
        The dates of your swim, bike and run legs and other events like the documentary premiere. Every client sees them in their Journey tab, with a link to your
        website.
      </p>
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 ? (
        <div className="empty small">No dates yet. Add your first challenge or event.</div>
      ) : (
        <div className="list">
          {data.map((e) => (
            <EventRow key={e.id} event={e} onClick={() => setEditing(e)} />
          ))}
        </div>
      )}
      {editing && (
        <EventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((list) => sort([...list.filter((x) => x.id !== saved.id), saved]));
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
