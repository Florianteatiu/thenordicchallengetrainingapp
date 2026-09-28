import { useEffect, useState } from "react";
import { Check, MessageSquareReply } from "lucide-react";
import { replyToCheckin, signedUrl } from "../lib/api";
import { addDays, formatDate, mondayOf, todayISO } from "../lib/dates";
import { ErrorBox } from "./ui";

// The four 1-5 questions. For stress, 1 = relaxed and 5 = very stressed.
export const SCALES = [
  { key: "sleep", label: "Sleep", low: "Terrible", high: "Great" },
  { key: "energy", label: "Energy", low: "Drained", high: "Buzzing" },
  { key: "stress", label: "Stress", low: "Relaxed", high: "Very stressed" },
  { key: "nutrition", label: "Nutrition", low: "Off track", high: "On point" },
];

// Which week a check-in filled in today is about: Friday to Monday it's the
// week that's ending; Tuesday to Thursday it's still last week's.
export function checkinWeek(today = todayISO()) {
  return mondayOf(addDays(today, -3));
}

// Friday, Saturday, Sunday and Monday: time to prompt for the check-in.
export function isCheckinTime(today = todayISO()) {
  const dow = (new Date(today + "T12:00").getDay() + 6) % 7; // 0 = Monday
  return dow >= 4 || dow === 0;
}

export function weekLabel(weekStart) {
  return `Week of ${formatDate(weekStart, { day: "numeric", month: "short" })}`;
}

// Good = green, middling = neutral, poor = red (stress is reversed).
function tone(key, v) {
  const good = key === "stress" ? v <= 2 : v >= 4;
  const bad = key === "stress" ? v >= 4 : v <= 2;
  return good ? "pill-green" : bad ? "pill-red" : "";
}

export function CheckinPhoto({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    signedUrl("checkin-photos", path).then(setUrl).catch(() => {});
  }, [path]);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="checkin-photo">
      <img src={url} alt="Progress" />
    </a>
  ) : (
    <div className="checkin-photo" />
  );
}

export function CheckinCard({ checkin, coach = false, coachName = "Florian", onReplied }) {
  const [reply, setReply] = useState(checkin.coach_reply ?? "");
  const [editing, setEditing] = useState(coach && !checkin.coach_reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const saved = await replyToCheckin(checkin.id, reply);
      setEditing(false);
      onReplied?.(saved);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card col gap-12">
      <div className="row between">
        <div>
          <div className="h3">{weekLabel(checkin.week_start)}</div>
          <div className="tiny faint">Sent {formatDate(checkin.created_at.slice(0, 10))}</div>
        </div>
        {checkin.bodyweight_kg && <span className="pill">{+checkin.bodyweight_kg} kg</span>}
      </div>

      <div className="chips">
        {SCALES.filter((s) => checkin[s.key]).map((s) => (
          <span key={s.key} className={`pill ${tone(s.key, checkin[s.key])}`}>
            {s.label} {checkin[s.key]}/5
          </span>
        ))}
      </div>

      {checkin.wins && (
        <div>
          <div className="eyebrow mb-4">Wins</div>
          <div className="small pre">{checkin.wins}</div>
        </div>
      )}
      {checkin.struggles && (
        <div>
          <div className="eyebrow mb-4">Struggles</div>
          <div className="small pre">{checkin.struggles}</div>
        </div>
      )}
      {checkin.notes && (
        <div>
          <div className="eyebrow mb-4">Anything else</div>
          <div className="small pre">{checkin.notes}</div>
        </div>
      )}
      {checkin.photo_paths?.length > 0 && (
        <div className="row gap-6 wrap">
          {checkin.photo_paths.map((p) => (
            <CheckinPhoto key={p} path={p} />
          ))}
        </div>
      )}

      {editing ? (
        <div className="col gap-6">
          <textarea className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your reply: what went well, what to focus on next week…" />
          <ErrorBox error={error} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {checkin.coach_reply && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
            <button className="btn btn-primary btn-sm" disabled={busy || !reply.trim()} onClick={send}>
              <MessageSquareReply size={15} /> {busy ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      ) : checkin.coach_reply ? (
        <div className="coach-reply">
          <div className="row between">
            <div className="eyebrow yellow">{coach ? "Your reply" : `${coachName}'s reply`}</div>
            {coach && (
              <button className="link-btn small" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
          <div className="small pre mt-4">{checkin.coach_reply}</div>
        </div>
      ) : (
        !coach && (
          <div className="tiny faint row gap-4">
            <Check size={13} /> Sent. {coachName} will reply soon.
          </div>
        )
      )}
    </div>
  );
}
