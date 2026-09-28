import { NavLink, Outlet } from "react-router-dom";
import { CalendarRange, Dumbbell, Inbox, Library, LogOut, UserRound, Users } from "lucide-react";
import { useConversations } from "../lib/useUnread";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/ui";

const NAV = [
  { to: "/coach", label: "Clients", icon: Users, end: true },
  { to: "/coach/inbox", label: "Inbox", icon: Inbox },
  { to: "/coach/programs", label: "Programs", icon: CalendarRange },
  { to: "/coach/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/coach/library", label: "Exercises", icon: Library },
];

export default function CoachLayout() {
  const { profile, signOut } = useAuth();
  const linkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;
  const conversations = useConversations();
  const unread = Object.values(conversations).reduce((n, c) => n + c.unread, 0);
  const badge = (to) => (to === "/coach/inbox" && unread > 0 ? <span className="nav-badge">{unread}</span> : null);

  return (
    <div className="coach-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="" style={{ width: 34, height: 34 }} />
          <div className="display" style={{ fontSize: 17 }}>
            Nordic
            <br />
            Challenge
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
            <n.icon size={18} /> {n.label}
            {badge(n.to)}
          </NavLink>
        ))}
        <div style={{ marginTop: "auto" }} className="col gap-4">
          <NavLink to="/coach/profile" className={linkClass}>
            <Avatar name={profile.full_name} url={profile.avatar_url} size={24} />
            <span className="ellipsis">{profile.full_name || "My profile"}</span>
          </NavLink>
          <button className="nav-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={signOut}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className="grow">
        <nav className="coach-topbar">
          <img src={logo} alt="" style={{ width: 26, height: 26, marginRight: 4 }} />
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {n.label}
              {badge(n.to)}
            </NavLink>
          ))}
          <NavLink to="/coach/profile" className={linkClass} aria-label="My profile">
            <UserRound size={17} />
          </NavLink>
        </nav>
        <main className="coach-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
