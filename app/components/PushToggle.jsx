import { useEffect, useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import { disablePush, enablePush, pushState } from "../lib/push";
import { ErrorBox } from "./ui";

// On/off switch for push notifications on this device, with help for the
// cases where it can't work yet (iPhone not installed, blocked, etc.).
export default function PushToggle({ description = "Get a notification when something happens." }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (!state || state === "unconfigured") return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === "enabled") await disablePush();
      else await enablePush();
      setState(await pushState());
    } catch (e) {
      setError(e);
      setState(await pushState().catch(() => state));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card col gap-8">
      <div className="row between">
        <div className="row">
          {state === "enabled" ? <Bell size={20} className="yellow" /> : <BellOff size={20} className="faint" />}
          <div>
            <div style={{ fontWeight: 700 }}>Notifications</div>
            <div className="tiny faint">{description}</div>
          </div>
        </div>
        {(state === "enabled" || state === "disabled") && (
          <button className={`btn btn-sm ${state === "enabled" ? "btn-ghost" : "btn-primary"}`} onClick={toggle} disabled={busy}>
            {busy ? "…" : state === "enabled" ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      {state === "needs-install" && (
        <div className="small muted">
          On iPhone, notifications work once the app is on your Home Screen: tap <Share size={13} style={{ verticalAlign: "-2px" }} /> Share in Safari, then{" "}
          <b>Add to Home Screen</b>, and open it from there.
        </div>
      )}
      {state === "denied" && <div className="small muted">Notifications are blocked for this app. Allow them in your phone's settings, then come back.</div>}
      {state === "unsupported" && <div className="small muted">This browser can't show notifications.</div>}
      <ErrorBox error={error} />
    </div>
  );
}
