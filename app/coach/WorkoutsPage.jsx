import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { copyWorkout, createWorkout, deleteWorkout, listWorkoutTemplates } from "../lib/api";
import { formatEstimate, formatLabel } from "../lib/format";
import { useCoachBase } from "../lib/base";
import { ErrorBox, PageLoader, useAsync } from "../components/ui";

export default function WorkoutsPage() {
  const navigate = useNavigate();
  const base = useCoachBase();
  const { data, loading, error, reload } = useAsync(listWorkoutTemplates, []);
  const [q, setQ] = useState("");
  const [actionError, setActionError] = useState(null);

  async function create() {
    try {
      const w = await createWorkout({ title: "New workout", isTemplate: true });
      navigate(`${base}/workouts/${w.id}`);
    } catch (e) {
      setActionError(e);
    }
  }

  async function run(fn) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  if (loading && !data) return <PageLoader />;
  const list = (data ?? []).filter((w) => w.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Templates</div>
          <h1 className="h1 mt-4">Workouts</h1>
          <p className="muted small mt-8" style={{ maxWidth: 560 }}>
            Single sessions you reuse across programs: a lower-body strength day, a 20-minute HIIT, a mobility flow…
          </p>
        </div>
        <button className="btn btn-primary" onClick={create}>
          <Plus size={17} /> New workout template
        </button>
      </div>
      <ErrorBox error={error || actionError} onRetry={error ? reload : undefined} />

      {(data?.length ?? 0) > 6 && (
        <div className="row mb-16" style={{ position: "relative", maxWidth: 360 }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {data?.length === 0 ? (
        <div className="empty">
          <div className="h3">No workout templates yet</div>
          <p className="small">Create your go-to sessions once, then drop them into any program in a click.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {list.map((w) => (
            <div key={w.id} className="card col">
              <Link to={`${base}/workouts/${w.id}`} className="grow">
                <div className="h3">{w.title}</div>
                <div className="small muted mt-4">{w.exerciseCount} {w.exerciseCount === 1 ? "exercise" : "exercises"}{w.estimateSec ? ` · ${formatEstimate(w.estimateSec)}` : ""}</div>
                <div className="chips mt-8">
                  {w.formats.map((f) => (
                    <span key={f} className="pill">
                      {formatLabel(f)}
                    </span>
                  ))}
                </div>
              </Link>
              <div className="row between">
                <Link className="btn btn-sm" to={`${base}/workouts/${w.id}`}>
                  Edit
                </Link>
                <div className="row gap-4">
                  <button className="icon-btn" title="Duplicate" onClick={() => run(() => copyWorkout(w.id, true))}>
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    onClick={() => window.confirm(`Delete "${w.title}"? Programs that already use it keep their own copy.`) && run(() => deleteWorkout(w.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
