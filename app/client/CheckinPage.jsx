import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { listCheckins, saveCheckin, uploadCheckinPhoto } from "../lib/api";
import { numOrNull } from "../lib/format";
import { COACH_FIRST_NAME } from "../config";
import { CheckinCard, CheckinPhoto, SCALES, checkinWeek, weekLabel } from "../components/Checkins";
import { ErrorBox, PageLoader, useAsync } from "../components/ui";

function Scale({ scale, value, onChange }) {
  return (
    <div>
      <div className="row between mb-8">
        <span style={{ fontWeight: 700 }}>{scale.label}</span>
        <span className="tiny faint">
          1 {scale.low} · 5 {scale.high}
        </span>
      </div>
      <div className="scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={value === n ? "active" : ""} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckinForm({ clientId, week, existing, onSaved }) {
  const [form, setForm] = useState(() => ({
    sleep: existing?.sleep ?? null,
    energy: existing?.energy ?? null,
    stress: existing?.stress ?? null,
    nutrition: existing?.nutrition ?? null,
    bodyweight: existing?.bodyweight_kg != null ? String(+existing.bodyweight_kg) : "",
    wins: existing?.wins ?? "",
    struggles: existing?.struggles ?? "",
    notes: existing?.notes ?? "",
    photos: existing?.photo_paths ?? [],
  }));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function addPhotos(e) {
    const files = [...(e.target.files ?? [])].slice(0, 3 - form.photos.length);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const paths = [];
      for (const f of files) paths.push(await uploadCheckinPhoto(clientId, f));
      setForm((f) => ({ ...f, photos: [...f.photos, ...paths] }));
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (SCALES.some((s) => !form[s.key])) return setError("Pick a number for each of the four questions.");
    const bw = numOrNull(form.bodyweight);
    if (form.bodyweight && (bw == null || bw < 20 || bw > 400)) return setError("Bodyweight should be in kg, e.g. 72.5");
    setBusy(true);
    setError(null);
    try {
      const saved = await saveCheckin({
        id: existing?.id,
        week_start: week,
        sleep: form.sleep,
        energy: form.energy,
        stress: form.stress,
        nutrition: form.nutrition,
        bodyweight_kg: bw,
        wins: form.wins.trim() || null,
        struggles: form.struggles.trim() || null,
        notes: form.notes.trim() || null,
        photo_paths: form.photos,
      });
      onSaved(saved);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <div className="card col gap-16">
      {SCALES.map((s) => (
        <Scale key={s.key} scale={s} value={form[s.key]} onChange={(v) => set(s.key, v)} />
      ))}
      <label className="field">
        <span>Bodyweight (kg, optional)</span>
        <input className="input" inputMode="decimal" value={form.bodyweight} onChange={(e) => set("bodyweight", e.target.value)} placeholder="e.g. 72.5" />
      </label>
      <label className="field">
        <span>Wins this week</span>
        <textarea className="textarea" value={form.wins} onChange={(e) => set("wins", e.target.value)} placeholder="Big or small: a PR, more sleep, said no to the extra beer…" />
      </label>
      <label className="field">
        <span>What was hard?</span>
        <textarea className="textarea" value={form.struggles} onChange={(e) => set("struggles", e.target.value)} placeholder="Missed sessions, sore spots, busy work week…" />
      </label>
      <label className="field">
        <span>Anything else {COACH_FIRST_NAME} should know?</span>
        <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <div>
        <div className="eyebrow mb-8">Progress photos (optional, only {COACH_FIRST_NAME} sees them)</div>
        <div className="row gap-6 wrap">
          {form.photos.map((p) => (
            <div key={p} style={{ position: "relative" }}>
              <CheckinPhoto path={p} />
              <button className="photo-remove" aria-label="Remove photo" onClick={() => set("photos", form.photos.filter((x) => x !== p))}>
                <X size={13} />
              </button>
            </div>
          ))}
          {form.photos.length < 3 && (
            <label className="checkin-photo add">
              <Camera size={20} />
              <span className="tiny">{uploading ? "Uploading…" : "Add"}</span>
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos} disabled={uploading} />
            </label>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={busy || uploading}>
        {busy ? "Sending…" : existing ? "Update check-in" : `Send to ${COACH_FIRST_NAME}`}
      </button>
    </div>
  );
}

export default function CheckinPage() {
  const { profile } = useAuth();
  const week = checkinWeek();
  const [editing, setEditing] = useState(false);
  const { data, loading, error, reload } = useAsync(() => listCheckins(profile.id), [profile.id]);

  if (loading && !data) return <PageLoader />;
  const checkins = data ?? [];
  const current = checkins.find((c) => c.week_start === week);
  const showForm = !current || editing;

  return (
    <div className="client-page">
      <Link to="/app" className="row small muted mb-12" style={{ gap: 4 }}>
        <ArrowLeft size={15} /> Today
      </Link>
      <div className="eyebrow">{weekLabel(week)}</div>
      <div className="h1 mt-4 mb-8">Weekly check-in</div>
      <div className="small muted mb-16">Two minutes to tell {COACH_FIRST_NAME} how your week really went. He reads every one and replies.</div>
      <ErrorBox error={error} onRetry={reload} />

      {showForm ? (
        <CheckinForm
          clientId={profile.id}
          week={week}
          existing={current}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      ) : (
        <div className="col gap-8">
          <CheckinCard checkin={current} coachName={COACH_FIRST_NAME} />
          {!current.coach_reply && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEditing(true)}>
              Edit my answers
            </button>
          )}
        </div>
      )}

      {checkins.filter((c) => c.week_start !== week).length > 0 && (
        <div className="section">
          <div className="eyebrow mb-8">Earlier check-ins</div>
          <div className="list">
            {checkins
              .filter((c) => c.week_start !== week)
              .map((c) => (
                <CheckinCard key={c.id} checkin={c} coachName={COACH_FIRST_NAME} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
