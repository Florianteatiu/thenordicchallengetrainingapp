import { useState } from "react";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { COACH_FIRST_NAME } from "../config";
import { firstName } from "../lib/format";
import logo from "../assets/logo.png";

// New sign-ups land here until Florian approves them (paying clients only).
export default function WaitingApproval() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const declined = profile.archived;

  async function check() {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  }

  return (
    <div className="client-page center col gap-16" style={{ maxWidth: 440, margin: "48px auto", padding: "0 16px" }}>
      <img src={logo} alt="The Nordic Challenge" style={{ width: 88, height: 88, alignSelf: "center" }} />
      <div className="h2">{declined ? "Your account isn't active" : `Welcome, ${firstName(profile.full_name) || "athlete"}!`}</div>
      <div className="muted">
        {declined
          ? `Your access is paused. If you think this is a mistake, message ${COACH_FIRST_NAME} directly.`
          : `Your account is created. ${COACH_FIRST_NAME} will open your access as soon as your coaching starts. You'll get straight in after that, no need to sign up again.`}
      </div>
      {!declined && (
        <div className="card card-tight row gap-6 small" style={{ justifyContent: "center" }}>
          <Clock size={16} className="yellow" /> Waiting for {COACH_FIRST_NAME} to approve
        </div>
      )}
      <button className="btn btn-primary" onClick={check} disabled={checking}>
        <RefreshCw size={16} /> {checking ? "Checking…" : "Check again"}
      </button>
      <button className="link-btn small row gap-4" style={{ alignSelf: "center" }} onClick={signOut}>
        <LogOut size={14} /> Sign out
      </button>
      <div className="tiny faint">Coached by Florian Teatiu</div>
    </div>
  );
}
