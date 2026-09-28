import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Home, TrendingUp, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getActiveProgramFor, getCoachProfile, listSessions } from "../lib/api";
import { sessionsByDay } from "../lib/gamify";
import { ErrorBox, PageLoader, useAsync } from "../components/ui";

const TABS = [
  { to: "/app", label: "Today", icon: Home, end: true },
  { to: "/app/plan", label: "Plan", icon: CalendarDays },
  { to: "/app/history", label: "Progress", icon: TrendingUp },
  { to: "/app/me", label: "Me", icon: UserRound },
];

// Loads everything the client tabs share (program, sessions, coach) once.
export default function ClientLayout() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [program, sessions, coach] = await Promise.all([getActiveProgramFor(profile.id), listSessions(profile.id), getCoachProfile()]);
    return { program, sessions, coach };
  }, [profile.id]);

  const context = useMemo(() => (data ? { ...data, sessionMap: sessionsByDay(data.sessions), reload } : null), [data, reload]);

  return (
    <div className="client-shell">
      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <div className="client-page">
          <ErrorBox error={error} onRetry={reload} />
        </div>
      ) : (
        <Outlet context={context} />
      )}
      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
              <t.icon size={22} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
