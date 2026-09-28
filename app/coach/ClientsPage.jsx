import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarX, Check, ClipboardCheck, Copy, Flame, MessageCircle, MoonStar, PartyPopper } from "lucide-react";
import { listActivePrograms, listClients, listRecentCheckinsAll, listRecentSessionsAll } from "../lib/api";
import { useConversations } from "../lib/useUnread";
import { addDays, daysBetween, formatDateTime, mondayOf, programDayDate, todayISO } from "../lib/dates";
import { firstName } from "../lib/format";
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

// Everything that deserves the coach's attention today, most urgent first.
function attentionItems(rows, conversations, checkins, sessions, today) {
  const items = [];
  const weekAgo = addDays(today, -7);
  for (const r of rows) {
    const c = r.client;
    if (c.archived) continue;
    const name = firstName(c.full_name) || c.full_name;
    const unread = conversations[c.id]?.unread ?? 0;
    if (unread) items.push({ key: `m${c.id}`, rank: 0, icon: MessageCircle, tone: "yellow", client: c, text: `${name} sent ${unread === 1 ? "a message" : `${unread} messages`}`, to: `/coach/inbox/${c.id}` });
    const waiting = checkins.filter((ci) => ci.client_id === c.id && !ci.coach_reply);
    if (waiting.length) items.push({ key: `c${c.id}`, rank: 1, icon: ClipboardCheck, tone: "yellow", client: c, text: `${name}'s check-in is waiting for your reply`, to: `/coach/inbox/${c.id}?tab=checkins` });
    const hard = sessions.find((x) => x.client_id === c.id && x.completed_at && x.completed_at.slice(0, 10) >= weekAgo && ((x.rpe ?? 0) >= 9 || (x.feeling ?? 5) <= 2));
    if (hard)
      items.push({
        key: `h${c.id}`,
        rank: 2,
        icon: AlertTriangle,
        tone: "red",
        client: c,
        text: `${name} found ${hard.workout_title || "a workout"} very tough${hard.rpe ? ` (RPE ${hard.rpe})` : ""}${hard.notes ? `: “${hard.notes}”` : ""}`,
        to: `/coach/clients/${c.id}`,
      });
    if (r.missed) items.push({ key: `x${c.id}`, rank: 3, icon: CalendarX, tone: "red", client: c, text: `${name} missed ${r.missed === 1 ? "a workout" : `${r.missed} workouts`} this week`, to: `/coach/clients/${c.id}` });
    const lastDone = r.last?.completed_at?.slice(0, 10);
    const idle = lastDone ? daysBetween(lastDone, today) : daysBetween(c.created_at.slice(0, 10), today);
    if (r.program && idle >= 7 && !r.missed) items.push({ key: `i${c.id}`, rank: 4, icon: MoonStar, tone: "", client: c, text: `${name} hasn't trained in ${idle} days`, to: `/coach/inbox/${c.id}` });
    if (!r.program) items.push({ key: `p${c.id}`, rank: 5, icon: Flame, tone: "yellow", client: c, text: `${name} needs a program`, to: `/coach/clients/${c.id}` });
  }
  return items.sort((a, b) => a.rank - b.rank);
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState(false);
  const today = todayISO();

  const { data, loading, error, reload } = useAsync(async () => {
    const [clients, programs, sessions, checkins] = await Promise.all([
      listClients(),
      listActivePrograms(),
      listRecentSessionsAll(addDays(mondayOf(today), -21)),
      listRecentCheckinsAll(addDays(today, -21)),
    ]);
    return { clients, programs, sessions, checkins };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.clients
      .filter((c) => showArchived || !c.archived)
      .map((c) => ({ client: c, ...summarize(c, data.programs.find((p) => p.client_id === c.id), data.sessions, today) }));
  }, [data, showArchived, today]);

  const conversations = useConversations();
  const attention = useMemo(
    () => (data ? attentionItems(rows, conversations, data.checkins, data.sessions, today) : []),
    [rows, conversations, data, today],
  );

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

      {rows.length > 0 && (
        <div className="section" style={{ marginTop: 0 }}>
          <div className="eyebrow mb-8">Needs your attention</div>
          {attention.length === 0 ? (
            <div className="card row">
              <PartyPopper size={20} className="green" />
              <div className="small">All good. Everyone's on track and nobody is waiting on you.</div>
            </div>
          ) : (
            <div className="list">
              {attention.slice(0, 8).map((a) => (
                <button key={a.key} className="card card-tight card-link attention-row" onClick={() => navigate(a.to)}>
                  <a.icon size={18} className={a.tone} />
                  <Avatar name={a.client.full_name} url={a.client.avatar_url} size={28} />
                  <span className="small grow" style={{ textAlign: "left" }}>{a.text}</span>
                </button>
              ))}
              {attention.length > 8 && <div className="tiny faint">+ {attention.length - 8} more</div>}
            </div>
          )}
        </div>
      )}

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
