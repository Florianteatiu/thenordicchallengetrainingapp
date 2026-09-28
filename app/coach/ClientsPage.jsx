import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { listActivePrograms, listClients, listRecentSessionsAll } from "../lib/api";
import { addDays, formatDateTime, mondayOf, programDayDate, todayISO } from "../lib/dates";
import { Avatar, ErrorBox, PageLoader, useAsync } from "../components/ui";

function summarize(client, program, sessions, today) {
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const mine = sessions.filter((s) => s.client_id === client.id);
  const doneByDay = new Set(mine.filter((s) => s.completed_at && s.program_day_id).map((s) => s.program_day_id));
  const weekDays = (program?.program_days ?? [])
    .map((d) => ({ ...d, date: programDayDate(program.start_date, d.week, d.day) }))
    .filter((d) => d.date >= weekStart && d.date <= weekEnd);
  const done = weekDays.filter((d) => doneByDay.has(d.id)).length;
  const missed = weekDays.filter((d) => d.date < today && !doneByDay.has(d.id)).length;
  const last = mine.find((s) => s.completed_at);
  const doneToday = mine.some((s) => s.completed_at && s.completed_at.slice(0, 10) === today);

  let status = { label: "On track", tone: "pill-green" };
  if (!program) status = { label: "Needs a program", tone: "pill-yellow" };
  else if (missed > 0) status = { label: `Missed ${missed}`, tone: "pill-red" };
  else if (weekDays.length === 0) status = { label: "Nothing this week", tone: "" };
  return { program, planned: weekDays.length, done, missed, last, doneToday, status };
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState(false);
  const today = todayISO();

  const { data, loading, error, reload } = useAsync(async () => {
    const [clients, programs, sessions] = await Promise.all([
      listClients(),
      listActivePrograms(),
      listRecentSessionsAll(addDays(mondayOf(today), -21)),
    ]);
    return { clients, programs, sessions };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.clients
      .filter((c) => showArchived || !c.archived)
      .map((c) => ({ client: c, ...summarize(c, data.programs.find((p) => p.client_id === c.id), data.sessions, today) }));
  }, [data, showArchived, today]);

  const counts = useMemo(
    () => ({
      noProgram: rows.filter((r) => !r.program && !r.client.archived).length,
      missed: rows.filter((r) => r.missed > 0).length,
      today: rows.filter((r) => r.doneToday).length,
    }),
    [rows],
  );

  function copyInvite() {
    navigator.clipboard?.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading && !data) return <PageLoader />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Coach</div>
          <h1 className="h1 mt-4">Clients</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyInvite}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Copy invite link"}
        </button>
      </div>

      <ErrorBox error={error} onRetry={reload} />

      <div className="stats mb-16">
        <div className="stat">
          <div className="stat-value green">{counts.today}</div>
          <div className="stat-label">Trained today</div>
        </div>
        <div className="stat">
          <div className={`stat-value ${counts.missed ? "red" : ""}`}>{counts.missed}</div>
          <div className="stat-label">Missed this week</div>
        </div>
        <div className="stat">
          <div className={`stat-value ${counts.noProgram ? "yellow" : ""}`}>{counts.noProgram}</div>
          <div className="stat-label">Need a program</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="h3">No clients yet</div>
          <p className="small">Copy the invite link above and send it to a client. Once they create an account, they'll appear here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Program</th>
                <th>This week</th>
                <th>Last workout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client.id} className="clickable" onClick={() => navigate(`/coach/clients/${r.client.id}`)}>
                  <td>
                    <div className="row">
                      <Avatar name={r.client.full_name} url={r.client.avatar_url} size={34} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.client.full_name}</div>
                        {r.client.archived && <div className="tiny faint">Archived</div>}
                      </div>
                    </div>
                  </td>
                  <td className="small">{r.program ? r.program.title : <span className="faint">None</span>}</td>
                  <td className="small nowrap">{r.planned ? `${r.done} / ${r.planned}` : <span className="faint">–</span>}</td>
                  <td className="small nowrap">{r.last ? formatDateTime(r.last.completed_at) : <span className="faint">Never</span>}</td>
                  <td>
                    <span className={`pill ${r.status.tone}`}>{r.status.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className="row small muted mt-12" style={{ gap: 6, cursor: "pointer" }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived clients
      </label>
    </div>
  );
}
