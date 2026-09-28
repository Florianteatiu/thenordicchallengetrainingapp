import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { DAY_SHORT, formatDate, programWeekForDate, todayISO } from "../lib/dates";
import { dayStatus } from "../lib/gamify";
import { WorkoutCard } from "./TodayPage";

export default function PlanPage() {
  const { program, sessionMap } = useOutletContext();
  const today = todayISO();
  const currentWeek = program ? programWeekForDate(program.start_date, today) : null;
  const currentRef = useRef(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "start" });
  }, []);

  if (!program) {
    return (
      <div className="client-page">
        <div className="h1 mb-16">Plan</div>
        <div className="empty">Your program will appear here as soon as your coach publishes it.</div>
      </div>
    );
  }

  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);

  return (
    <div className="client-page">
      <div className="eyebrow">Your program</div>
      <div className="h1 mt-4">{program.title}</div>
      {program.description && <p className="muted small mt-8">{program.description}</p>}

      {weeks.map((week) => {
        const days = program.days.filter((d) => d.week === week);
        const done = days.filter((d) => dayStatus(d, sessionMap, today) === "done").length;
        const isCurrent = week === currentWeek;
        return (
          <div key={week} className="section" ref={isCurrent ? currentRef : null} style={{ scrollMarginTop: 16 }}>
            <div className="section-title">
              <div className="row gap-6">
                <span className="h2">Week {week}</span>
                {isCurrent && <span className="pill pill-yellow">This week</span>}
              </div>
              <span className="small faint">
                {done}/{days.length} done
              </span>
            </div>
            {days.length === 0 ? (
              <div className="small faint">No workouts planned.</div>
            ) : (
              <div className="list">
                {days.map((d) => (
                  <div key={d.id}>
                    <div className="tiny faint mb-8" style={{ marginBottom: 4 }}>
                      {d.date ? formatDate(d.date, { weekday: "long", day: "numeric", month: "short" }) : DAY_SHORT[d.day - 1]}
                    </div>
                    <WorkoutCard day={d} status={dayStatus(d, sessionMap, today)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
