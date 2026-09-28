import { Link, NavLink, Outlet } from "react-router-dom";
import { Dumbbell, Library, Users, Wifi } from "lucide-react";
import logo from "../assets/logo.png";

const TABS = [
  { to: "/pt", label: "Clients", icon: Users, end: true },
  { to: "/pt/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/pt/library", label: "Exercises", icon: Library },
];

// Nordic PT: the in-person coaching app. Same login and exercise library as
// the online app, its own clients and sessions.
export default function PtLayout() {
  return (
    <div className="pt-shell">
      <header className="pt-top">
        <Link to="/pt" className="row gap-6">
          <img src={logo} alt="" style={{ width: 28, height: 28 }} />
          <span className="display" style={{ fontSize: 20 }}>
            Nordic <span className="yellow">PT</span>
          </span>
        </Link>
        <a href="/coach" className="pill" title="Switch to the online coaching app">
          <Wifi size={12} /> Online app
        </a>
      </header>
      <main className="pt-main">
        <Outlet />
      </main>
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
