import { useState } from "react";
import { Bike, BookOpen, Check, Flag, Footprints, MapPin, Plus, Trash2, Waves } from "lucide-react";
import { deleteActivity, getJourneyTotals, listActivities, logActivity } from "../lib/api";
import { formatDate, todayISO } from "../lib/dates";
import { formatActivityDuration, formatKm, numOrNull, parseActivityDuration } from "../lib/format";
import { LEG, LEGS, legProgress, newlyReached, stops } from "../lib/journey";
import { ErrorBox, Modal, ProgressBar, Spinner, useAsync } from "./ui";
import SwedenMap from "./SwedenMap";

export const LEG_ICON = { run: Footprints, bike: Bike, swim: Waves };

function LogActivityModal({ kind: initialKind, onClose, onSaved }) {
  const [kind, setKind] = useState(initialKind);
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    const distanceKm = numOrNull(km);
    if (!distanceKm || distanceKm <= 0) return setError("Enter the distance in km.");
    if (distanceKm > 500) return setError("That's a very long one! Log up to 500 km at a time.");
    setBusy(true);
    setError(null);
    try {
      const activity = await logActivity({ kind, distanceKm, durationSec: parseActivityDuration(time), date, notes });
      onSaved(activity);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Log a ${LEG[kind].label.toLowerCase()}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save and move on the map"}
        </button>
      }
    >
      <div className="col gap-16">
        <div className="segmented">
          {LEGS.map((l) => {
            const Icon = LEG_ICON[l.kind];
            return (
              <button key={l.kind} className={kind === l.kind ? "active" : ""} onClick={() => setKind(l.kind)} style={kind === l.kind ? { background: l.color } : undefined}>
                <Icon size={16} /> {l.label}
              </button>
            );
          })}
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Distance (km)</span>
            <input className="input" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder={kind === "swim" ? "1.5" : "5"} autoFocus />
          </label>
          <label className="field">
            <span>Time (optional)</span>
            <input className="input" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="45 or 1:05:00" />
          </label>
        </div>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Note (optional)</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" />
        </label>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

function ReachedModal({ leg, places, onClose }) {
  const last = places[places.length - 1];
  const finished = last.km === leg.totalKm;
  return (
    <Modal title={finished ? "Leg complete!" : "New place reached"} onClose={onClose}>
      <div className="col gap-12" style={{ textAlign: "center", alignItems: "center" }}>
        <div className="reached-badge" style={{ background: leg.color }}>{finished ? <Flag size={30} /> : <MapPin size={30} />}</div>
        <div className="h1">{last.name}</div>
        <div className="muted">
          {finished
            ? `You've ${leg.kind === "swim" ? "swum" : leg.kind === "bike" ? "cycled" : "run"} all the way from ${leg.from} to ${leg.to}. That's ${leg.totalKm} km. Legendary.`
            : `${formatKm(last.km)} km from ${leg.from}. Keep going!`}
        </div>
        {places
          .filter((p) => p.story)
          .map((p) => (
            <div key={p.name} className="card card-tight" style={{ textAlign: "left", width: "100%" }}>
              <div className="eyebrow yellow mb-8">Florian's story · {p.name}</div>
              <div className="small">{p.story}</div>
            </div>
          ))}
        <button className="btn btn-primary btn-block mt-8" onClick={onClose}>
          Keep going
        </button>
      </div>
    </Modal>
  );
}

// The whole journey for one client. Editable (log/delete) only for the client.
export default function JourneyView({ clientId, editable = false }) {
  const [focus, setFocus] = useState("swim");
  const [logging, setLogging] = useState(false);
  const [reached, setReached] = useState(null);
  const [story, setStory] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const [totals, activities] = await Promise.all([getJourneyTotals(clientId), listActivities(clientId)]);
    return { totals, activities };
  }, [clientId]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const { totals, activities } = data;
  const leg = LEG[focus];
  const prog = legProgress(leg, totals[focus]);
  const Icon = LEG_ICON[focus];
  const grand = totals.run + totals.bike + totals.swim;

  async function onSaved(activity) {
    setLogging(false);
    const before = totals[activity.kind];
    const fresh = await reload();
    setFocus(activity.kind);
    const places = newlyReached(LEG[activity.kind], before, fresh?.totals[activity.kind] ?? before);
    if (places.length) setReached({ leg: LEG[activity.kind], places });
  }

  async function remove(a) {
    if (!window.confirm(`Delete this ${formatKm(a.distance_km)} km ${LEG[a.kind].label.toLowerCase()}?`)) return;
    setActionError(null);
    try {
      await deleteActivity(a.id);
      reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div className="col gap-16">
      <div className="map-card">
        <SwedenMap totals={totals} focus={focus} />
        <div className="map-total">
          <div className="display" style={{ fontSize: 30 }}>{formatKm(grand)}</div>
          <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: "0.06em" }}>KM ACROSS SWEDEN</div>
        </div>
      </div>

      <div className="segmented">
        {LEGS.map((l) => {
          const LIcon = LEG_ICON[l.kind];
          return (
            <button key={l.kind} className={focus === l.kind ? "active" : ""} onClick={() => setFocus(l.kind)} style={focus === l.kind ? { background: l.color } : undefined}>
              <LIcon size={16} /> {l.label}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="row between">
          <div>
            <div className="eyebrow">
              {leg.verb} · {leg.from} → {leg.to}
            </div>
            <div className="row gap-6 mt-4" style={{ alignItems: "baseline" }}>
              <span className="display" style={{ fontSize: 40, color: leg.color }}>{formatKm(prog.km)}</span>
              <span className="muted">/ {leg.totalKm} km</span>
            </div>
          </div>
          <div className="leg-icon" style={{ background: leg.color }}>
            <Icon size={22} />
          </div>
        </div>
        <div className="mt-8 leg-bar" style={{ "--leg": leg.color }}>
          <ProgressBar value={prog.fraction} />
        </div>
        <div className="small mt-8">
          {prog.finished ? (
            <span style={{ color: leg.color, fontWeight: 700 }}>Finished! You made it to {leg.to}. 🏁</span>
          ) : (
            <>
              <span className="muted">Next stop </span>
              <b>{prog.next.name}</b>
              <span className="muted"> in {formatKm(prog.toNext)} km</span>
            </>
          )}
        </div>
        {editable && (
          <button className="btn btn-primary btn-block mt-16" onClick={() => setLogging(true)}>
            <Plus size={18} /> Log a {leg.label.toLowerCase()}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {stops(leg).map((p, i) => {
          const isReached = prog.km >= p.km;
          const isNext = prog.next?.name === p.name;
          return (
            <div key={p.name} className="place-row" style={{ borderTop: i ? "1px solid var(--line)" : "none", opacity: isReached || isNext ? 1 : 0.5 }}>
              <div className="place-dot" style={isReached ? { background: leg.color, borderColor: leg.color, color: "#000" } : { borderColor: leg.color }}>
                {isReached && <Check size={12} strokeWidth={3} />}
              </div>
              <div className="grow">
                <div style={{ fontWeight: isNext ? 800 : 600 }}>{p.name}</div>
                <div className="tiny faint">{p.km} km</div>
              </div>
              {p.story && isReached && (
                <button className="icon-btn" aria-label={`Read the story of ${p.name}`} onClick={() => setStory(p)}>
                  <BookOpen size={17} />
                </button>
              )}
              {isNext && <span className="pill pill-yellow">Next</span>}
            </div>
          );
        })}
      </div>

      <div>
        <div className="eyebrow mb-8">Logged activities</div>
        <ErrorBox error={actionError} />
        {activities.length === 0 ? (
          <div className="empty small">
            {editable
              ? "Log your swims, rides and runs here. Distance from workouts in your program counts automatically."
              : "No swims, rides or runs logged yet."}
          </div>
        ) : (
          <div className="list">
            {activities.slice(0, 30).map((a) => {
              const AIcon = LEG_ICON[a.kind];
              return (
                <div key={a.id} className="card card-tight row">
                  <div className="leg-icon small" style={{ background: LEG[a.kind].color }}>
                    <AIcon size={16} />
                  </div>
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>
                      {formatKm(a.distance_km)} km {LEG[a.kind].label.toLowerCase()}
                      {a.duration_sec ? <span className="muted" style={{ fontWeight: 500 }}> · {formatActivityDuration(a.duration_sec)}</span> : null}
                    </div>
                    <div className="tiny faint">
                      {formatDate(a.activity_date)}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </div>
                  </div>
                  {editable && (
                    <button className="icon-btn" aria-label="Delete" onClick={() => remove(a)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {logging && <LogActivityModal kind={focus} onClose={() => setLogging(false)} onSaved={onSaved} />}
      {reached && <ReachedModal leg={reached.leg} places={reached.places} onClose={() => setReached(null)} />}
      {story && (
        <Modal title={story.name} onClose={() => setStory(null)}>
          <div className="eyebrow yellow mb-8">Florian's story</div>
          <div>{story.story}</div>
        </Modal>
      )}
    </div>
  );
}
