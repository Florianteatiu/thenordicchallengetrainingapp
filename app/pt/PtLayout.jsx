import { Link, NavLink, Outlet } from "react-router-dom";
import { Dumbbell, Library, Users } from "lucide-react";
import logo from "../assets/logo.png";

const TABS = [
  { to: "/pt", label: "Clients", icon: Users, end: true },
  { to: "/pt/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/pt/library", label: "Exercises", icon: Library },
];

// Nordic PT: the in-person coaching app. Same login and exercise library as
// the online app, its own clients and sessions. No link to the online app:
// on iPhone a home-screen app can't open another one, it opens a browser
// sheet on top instead (and closing it breaks the safe area at the top).
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
