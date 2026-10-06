import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { listWeightedSets } from "../lib/api";
import { formatDate } from "../lib/dates";
import { ErrorBox, Spinner, useAsync } from "./ui";

// Estimated one-rep max (Epley). Above 12 reps the estimate gets silly, so
// those sets just count as their weight.
const e1rm = (kg, reps) => (reps && reps > 1 && reps <= 12 ? kg * (1 + reps / 30) : kg);
const round = (n) => Math.round(n * 2) / 2;

function summarize(rows) {
  const byExercise = new Map();
  for (const r of rows) {
    const kg = Number(r.load_kg);
    const ex = byExercise.get(r.exercise_id) ?? { id: r.exercise_id, name: r.exercise?.name ?? "Exercise", sessions: new Map(), sets: 0 };
    ex.sets += 1;
    const s = ex.sessions.get(r.session_id) ?? { date: r.created_at.slice(0, 10), top: 0, est: 0, topReps: 0 };
    if (kg > s.top || (kg === s.top && (r.reps ?? 0) > s.topReps)) {
      s.top = kg;
      s.topReps = r.reps ?? 0;
    }
    s.est = Math.max(s.est, e1rm(kg, r.reps));
    ex.sessions.set(r.session_id, s);
    byExercise.set(r.exercise_id, ex);
  }
  return [...byExercise.values()]
    .map((ex) => {
      const points = [...ex.sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
      const best = points.reduce((m, p) => (p.top > m.top ? p : m), points[0]);
      return { ...ex, points, best, first: points[0], last: points[points.length - 1] };
    })
    .sort((a, b) => b.sets - a.sets);
}

function Chart({ points }) {
  const W = 320;
  const H = 150;
  const P = { l: 34, r: 10, t: 12, b: 22 };
  const values = points.map((p) => p.est);
  const min = Math.floor(Math.min(...values) * 0.95);
  const max = Math.max(Math.ceil(Math.max(...values) * 1.03), min + 1);
  const x = (i) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.est).toFixed(1)}`).join(" ");
  const area = `${x(0)},${H - P.b} ${line} ${x(points.length - 1)},${H - P.b}`;
  // Unique values only: a repeated tick label would be drawn twice on top of itself.
  const ticks = [...new Set([min, Math.round((min + max) / 2), max])];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lift-chart" role="img" aria-label="Estimated max over time">
      <defs>
        <linearGradient id="liftfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFE234" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFE234" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" />
          <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="#75736f">
            {t}
          </text>
        </g>
      ))}
      {points.length > 1 && <polygon points={area} fill="url(#liftfill)" />}
      <polyline points={line} fill="none" stroke="#FFE234" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.est)} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? "#FFE234" : "#000"} stroke="#FFE234" strokeWidth="2" />
      ))}
      <text x={P.l} y={H - 5} fontSize="9.5" fill="#75736f">
        {formatDate(points[0].date, { day: "numeric", month: "short" })}
      </text>
      {points.length > 1 && (
        <text x={W - P.r} y={H - 5} fontSize="9.5" fill="#75736f" textAnchor="end">
          {formatDate(points[points.length - 1].date, { day: "numeric", month: "short" })}
        </text>
      )}
    </svg>
  );
}

// `load` swaps in another source of sets (the in-person app passes its own).
export default function LiftProgress({ clientId, load = listWeightedSets }) {
  const { data, loading, error, reload } = useAsync(() => load(clientId), [clientId, load]);
  const lifts = useMemo(() => (data ? summarize(data) : []), [data]);
  const [selected, setSelected] = useState(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!lifts.length) return <div className="empty small">Log a few weighted sets and your strength curves show up here.</div>;

  const lift = lifts.find((l) => l.id === selected) ?? lifts[0];
  const change = lift.last.est - lift.first.est;

  return (
    <div className="col gap-12">
      <div className="chips">
        {lifts.slice(0, 12).map((l) => (
          <button key={l.id} className={`chip${l.id === lift.id ? " active" : ""}`} onClick={() => setSelected(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="row between">
          <div className="h3">{lift.name}</div>
          {lift.points.length > 1 && change !== 0 && (
            <span className={`pill ${change > 0 ? "pill-green" : "pill-red"}`}>
              <TrendingUp size={13} /> {change > 0 ? "+" : ""}
              {round(change)} kg
            </span>
          )}
        </div>
        <div className="stats mt-12">
          <div className="stat">
            <div className="stat-value yellow">{+lift.best.top}</div>
            <div className="stat-label">Heaviest (kg)</div>
          </div>
          <div className="stat">
            <div className="stat-value">{round(Math.max(...lift.points.map((p) => p.est)))}</div>
            <div className="stat-label">Est. 1-rep max</div>
          </div>
          <div className="stat">
            <div className="stat-value">{lift.points.length}</div>
            <div className="stat-label">Sessions</div>
          </div>
        </div>
        <div className="mt-12">
          <Chart points={lift.points} />
        </div>
        <div className="tiny faint mt-4">Line = estimated 1-rep max from your best set each session.</div>
      </div>
    </div>
  );
}
