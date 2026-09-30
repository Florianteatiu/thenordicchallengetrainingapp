import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import LiftProgress from "../components/LiftProgress";
import { addDays, formatDateTime, mondayOf, todayISO } from "../lib/dates";
import { POINTS, levelFor, totalXp } from "../lib/gamify";
import SessionDetailModal, { FEELINGS } from "../components/SessionDetail";

export default function HistoryPage() {
  const { sessions } = useOutletContext();
  const { profile } = useAuth();
  const [open, setOpen] = useState(null);
  const completed = useMemo(() => sessions.filter((s) => s.completed_at), [sessions]);
  const level = levelFor(totalXp(sessions));

  // Workouts per week, last 8 weeks.
  const weeks = useMemo(() => {
    const thisMonday = mondayOf(todayISO());
    return Array.from({ length: 8 }, (_, i) => {
      const start = addDays(thisMonday, -7 * (7 - i));
      const end = addDays(start, 7);
      const count = completed.filter((s) => {
        const d = s.completed_at.slice(0, 10);
        return d >= start && d < end;
      }).length;
      return { start, count };
    });
  }, [completed]);
  const max = Math.max(3, ...weeks.map((w) => w.count));

  return (
    <div className="client-page">
      <div className="h1 mb-16">Progress</div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{completed.length}</div>
          <div className="stat-label">Workouts</div>
        </div>
        <div className="stat">
          <div className="stat-value yellow">{level.xp}</div>
          <div className="stat-label">{POINTS}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{level.number}</div>
          <div className="stat-label">Level</div>
        </div>
      </div>

      <div className="card mt-12">
        <div className="eyebrow mb-12">Workouts per week</div>
        <div className="row" style={{ alignItems: "flex-end", height: 110, gap: 8 }}>
          {weeks.map((w, i) => (
            <div key={w.start} className="grow col" style={{ alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <div className="tiny faint">{w.count || ""}</div>
              <div
                style={{
                  width: "100%",
                  height: `${(w.count / max) * 80}%`,
                  minHeight: 4,
                  borderRadius: 6,
                  background: i === weeks.length - 1 ? "var(--yellow)" : w.count ? "var(--surface-3)" : "var(--surface-2)",
                }}
              />
            </div>
          ))}
        </div>
        <div className="row between tiny faint mt-8">
          <span>8 weeks ago</span>
          <span>This week</span>
        </div>
      </div>

      <div className="section">
        <div className="eyebrow mb-8">Strength</div>
        <LiftProgress clientId={profile.id} />
      </div>

      <Link to="/app/checkin" className="card card-link row mt-16" style={{ display: "flex" }}>
        <ClipboardCheck size={20} className="yellow" />
        <div className="grow" style={{ fontWeight: 700 }}>
          Weekly check-ins
        </div>
        <ChevronRight size={18} className="faint" />
      </Link>

      <div className="section">
        <div className="eyebrow mb-8">History</div>
        {sessions.length === 0 ? (
          <div className="empty">Your finished workouts will show up here.</div>
        ) : (
          <div className="list">
            {sessions.map((s) => (
              <button key={s.id} className="card card-tight card-link row between" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpen(s.id)}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{s.workout_title}</div>
                  <div className="small muted">{s.completed_at ? formatDateTime(s.completed_at) : "Not finished"}</div>
                </div>
                {s.feeling && <span style={{ fontSize: 22 }}>{FEELINGS[s.feeling - 1]}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <SessionDetailModal sessionId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
