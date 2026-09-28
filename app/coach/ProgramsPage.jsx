import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Plus, Trash2 } from "lucide-react";
import { copyProgram, createProgram, deleteProgram, listProgramTemplates } from "../lib/api";
import { ErrorBox, PageLoader, useAsync } from "../components/ui";

export default function ProgramsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listProgramTemplates, []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function create() {
    setBusy(true);
    try {
      const p = await createProgram({ title: "New program template", isTemplate: true, weeks: 4 });
      navigate(`/coach/programs/${p.id}`);
    } catch (e) {
      setActionError(e);
      setBusy(false);
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

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Templates</div>
          <h1 className="h1 mt-4">Programs</h1>
          <p className="muted small mt-8" style={{ maxWidth: 560 }}>
            Multi-week plans you can reuse. Assigning one to a client makes a personal copy you can then tailor.
          </p>
        </div>
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          <Plus size={17} /> New program template
        </button>
      </div>
      <ErrorBox error={error || actionError} onRetry={error ? reload : undefined} />

      {data?.length === 0 ? (
        <div className="empty">
          <div className="h3">No program templates yet</div>
          <p className="small">Build one for a common goal, like "Strength base, 4 weeks" or "Hybrid engine, 6 weeks".</p>
        </div>
      ) : (
        <div className="grid-cards">
          {(data ?? []).map((p) => (
            <div key={p.id} className="card col">
              <Link to={`/coach/programs/${p.id}`} className="grow">
                <div className="h3">{p.title}</div>
                <div className="small muted mt-4">
                  {p.weeks} weeks · {p.program_days.length} workouts
                </div>
                {p.description && <div className="small faint mt-8">{p.description}</div>}
              </Link>
              <div className="row between">
                <Link className="btn btn-sm" to={`/coach/programs/${p.id}`}>
                  Edit
                </Link>
                <div className="row gap-4">
                  <button className="icon-btn" title="Duplicate" onClick={() => run(() => copyProgram({ programId: p.id, asTemplate: true }))}>
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    onClick={() => window.confirm(`Delete template "${p.title}"? Clients who already got it keep their copy.`) && run(() => deleteProgram(p.id))}
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
