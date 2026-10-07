import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Check, ChevronRight, ClipboardCheck, Flame, Play, Trophy } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { DAY_LETTER, addDays, formatDate, greetingForNow, mondayOf, todayISO } from "../lib/dates";
import { firstName, formatEstimate, formatLabel } from "../lib/format";
import { POINTS, dayStatus, levelFor, totalXp, workoutStreak } from "../lib/gamify";
import { companionLine, MOODS } from "../lib/companion";
import Companion from "../components/Companion";
import { ProgressBar, useAsync } from "../components/ui";
import { listEvents } from "../lib/api";
import { EventRow, eventStatus } from "../components/ChallengeCalendar";
import { checkinWeek, isCheckinTime } from "../components/Checkins";

export function WorkoutCard({ day, status, big }) {
  const done = status === "done";
  const started = status === "started" || status === "partial";
  return (
    <Link to={`/app/workout/${day.id}`} className={`card card-link ${big && !done ? "card-yellow" : ""}`} style={{ display: "block" }}>
      <div className="row between">
        <div className="grow">
          <div className="eyebrow" style={big && !done ? { color: "rgba(0,0,0,0.55)" } : undefined}>
            {done ? "Completed" : started ? "In progress" : day.date ? formatDate(day.date) : `Week ${day.week}`}
          </div>
          <div className={big ? "h2 mt-4" : "h3 mt-4"}>{day.workout?.title}</div>
          <div className="small mt-4 muted">
            {day.exerciseCount} {day.exerciseCount === 1 ? "exercise" : "exercises"}
            {day.estimateSec ? ` · ${formatEstimate(day.estimateSec)}` : ""}
            {day.formats.filter((f) => f !== "sets").length > 0 && ` · ${day.formats.filter((f) => f !== "sets").map(formatLabel).join(", ")}`}
          </div>
        </div>
        {done ? (
          <div className="week-dot dot-done" style={{ width: 36, height: 36 }}>
            <Check size={20} />
          </div>
        ) : big ? (
          <div className="btn btn-dark" style={{ padding: 14 }}>
            <Play size={22} fill="currentColor" />
          </div>
        ) : (
          <ChevronRight size={20} className="faint" />
        )}
      </div>
    </Link>
  );
}

export default function TodayPage() {
  const { profile } = useAuth();
  const { program, sessions, sessionMap, coach, checkins } = useOutletContext();
  const today = todayISO();
  const name = firstName(profile.full_name);

  const view = useMemo(() => {
    const days = program?.days ?? [];
    const todays = days.filter((d) => d.date === today);
    const upcoming = days.filter((d) => d.date && d.date > today).slice(0, 3);
    const streak = workoutStreak(days, sessionMap, today);
    const xp = totalXp(sessions);
    const level = levelFor(xp);
    const weekStart = mondayOf(today);
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const ds = days.filter((d) => d.date === date);
      const statuses = ds.map((d) => dayStatus(d, sessionMap, today));
      let status = "rest";
      if (statuses.length) {
        if (statuses.every((s) => s === "done")) status = "done";
        else if (statuses.includes("missed") || statuses.includes("partial")) status = "missed";
        else status = date === today ? "today" : "planned";
      }
      return { date, status, isToday: date === today };
    });
    const weekDone = sessions.filter((s) => s.completed_at && s.completed_at.slice(0, 10) >= weekStart).length;
    const missedRecent = days.some((d) => d.date >= addDays(today, -7) && dayStatus(d, sessionMap, today) === "missed");
    const lastDate = days.length ? days[days.length - 1].date : null;

    let situation;
    if (!program) situation = "noProgram";
    else if (todays.length) {
      const st = todays.map((d) => dayStatus(d, sessionMap, today));
      if (st.every((s) => s === "done")) situation = streak >= 3 ? "streak" : "doneToday";
      else if (st.includes("started")) situation = "workoutStarted";
      else situation = missedRecent ? "missed" : "workoutToday";
    } else if (lastDate && lastDate < today) situation = "programDone";
    else situation = missedRecent ? "missed" : streak >= 3 ? "streak" : "restDay";

    return { todays, upcoming, streak, xp, level, week, weekDone, situation };
  }, [program, sessions, sessionMap, today]);

  const events = useAsync(listEvents, []);
  const soonEvent = (events.data ?? []).find(
    (e) => eventStatus(e, today) === "now" || (eventStatus(e, today) === "upcoming" && e.starts_on <= addDays(today, 7)),
  );
  const week = checkinWeek(today);
  const checkinDue = isCheckinTime(today) && !(checkins ?? []).some((c) => c.week_start === week);
  const newReply = (checkins ?? []).find((c) => c.coach_reply && c.coach_replied_at && Date.now() - new Date(c.coach_replied_at) < 3 * 86400000);

  const line = companionLine(view.situation, { name, streak: view.streak, workout: view.todays[0]?.workout?.title ?? "your session" });

  return (
    <div className="client-page">
      <div className="row between mb-16">
        <div>
          <div className="eyebrow">{greetingForNow()}</div>
          <div className="h1 mt-4">{name || "Athlete"}</div>
        </div>
        <Link to="/app/me" className="pill pill-yellow" style={{ padding: "6px 10px" }}>
          <Trophy size={13} /> Lvl {view.level.number} · {view.level.name}
        </Link>
      </div>

      <Companion mood={MOODS[view.situation]} coachAvatar={coach?.avatar_url}>
        {line}
      </Companion>

      {soonEvent && (
        <Link to="/app/journey" className="mt-16" style={{ display: "block" }}>
          <EventRow event={{ ...soonEvent, description: null }} />
        </Link>
      )}

      {(checkinDue || newReply) && (
        <Link to="/app/checkin" className="card card-link row mt-16" style={{ display: "flex", borderColor: "rgba(255,226,52,0.35)" }}>
          <div className="leg-icon small" style={{ background: "var(--yellow)" }}>
            <ClipboardCheck size={18} />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>{checkinDue ? "Weekly check-in" : `${coach?.full_name?.split(" ")[0] || "Your coach"} replied to your check-in`}</div>
            <div className="small muted">{checkinDue ? "2 minutes: how did your week really go?" : "Tap to read it."}</div>
          </div>
          <ChevronRight size={20} className="faint" />
        </Link>
      )}

      <div className="section">
        {view.todays.length > 0 ? (
          <div className="col">
            {view.todays.map((d) => (
              <WorkoutCard key={d.id} day={d} status={dayStatus(d, sessionMap, today)} big />
            ))}
          </div>
        ) : program ? (
          <div className="card">
            <div className="eyebrow">Today</div>
            <div className="h2 mt-4">Rest day</div>
            <div className="small muted mt-4">Walk, stretch, hydrate, sleep. Recovery is where you get stronger.</div>
          </div>
        ) : null}
      </div>

      {program && (
        <div className="section">
          <div className="section-title">
            <div className="eyebrow">This week</div>
            <Link to="/app/plan" className="small yellow">
              Full plan
            </Link>
          </div>
          <div className="week-strip">
            {view.week.map((d, i) => (
              <div key={d.date} className={`week-day${d.isToday ? " is-today" : ""}`}>
                {DAY_LETTER[i]}
                <div className={`week-dot dot-${d.status}`}>{d.status === "done" && <Check size={13} strokeWidth={3} />}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section stats">
        <div className="stat">
          <div className="stat-value row gap-4">
            <Flame size={22} className={view.streak ? "yellow" : "faint"} />
            {view.streak}
          </div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {view.weekDone}
            <span className="faint" style={{ fontSize: 18 }}>/{profile.weekly_target}</span>
          </div>
          <div className="stat-label">This week</div>
        </div>
        <div className="stat">
          <div className="stat-value yellow">{view.xp}</div>
          <div className="stat-label">{POINTS}</div>
        </div>
      </div>
      <div className="card card-tight mt-8">
        <div className="row between small mb-8">
          <span style={{ fontWeight: 700 }}>{view.level.name}</span>
          <span className="faint">{view.level.next ? `${view.level.next.min - view.xp} ${POINTS} to ${view.level.next.name}` : "Max level!"}</span>
        </div>
        <ProgressBar value={view.level.progress} />
      </div>

      {view.upcoming.length > 0 && (
        <div className="section">
          <div className="eyebrow mb-8">Coming up</div>
          <div className="list">
            {view.upcoming.map((d) => (
              <WorkoutCard key={d.id} day={d} status={dayStatus(d, sessionMap, today)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
