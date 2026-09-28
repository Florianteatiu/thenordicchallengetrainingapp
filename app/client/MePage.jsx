import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Camera, Check, Lock } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile, uploadAvatar } from "../lib/api";
import { LEVELS, levelFor, totalXp } from "../lib/gamify";
import { Avatar, CommitInput, ErrorBox } from "../components/ui";

export default function MePage() {
  const { profile, setProfile, signOut } = useAuth();
  const { sessions } = useOutletContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const level = levelFor(totalXp(sessions));

  async function save(field, value) {
    try {
      setProfile(await updateProfile(profile.id, { [field]: field === "full_name" ? value.trim() || profile.full_name : value.trim() || null }));
    } catch (e) {
      setError(e);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setProfile(await uploadAvatar(profile.id, file));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="client-page">
      <div className="col" style={{ alignItems: "center", textAlign: "center" }}>
        <label style={{ position: "relative", cursor: "pointer" }}>
          <Avatar name={profile.full_name} url={profile.avatar_url} size={96} />
          <span className="btn btn-primary" style={{ position: "absolute", right: -4, bottom: -4, padding: 8 }}>
            <Camera size={15} />
          </span>
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
        {busy && <div className="tiny faint">Uploading…</div>}
        <div className="h1 mt-8">{profile.full_name}</div>
        <div className="pill pill-yellow">
          Level {level.number} · {level.name}
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="section">
        <div className="eyebrow mb-8">Your journey</div>
        <div className="card" style={{ padding: 0 }}>
          {LEVELS.map((l, i) => {
            const reached = level.xp >= l.min;
            const current = i + 1 === level.number;
            return (
              <div key={l.name} className="row" style={{ padding: "12px 14px", borderTop: i ? "1px solid var(--line)" : "none", opacity: reached ? 1 : 0.5 }}>
                <div className={`week-dot ${reached ? "dot-done" : ""}`} style={!reached ? { border: "2px solid var(--line-strong)" } : undefined}>
                  {reached ? <Check size={13} strokeWidth={3} /> : <Lock size={11} />}
                </div>
                <div className="grow">
                  <div style={{ fontWeight: current ? 800 : 600 }} className={current ? "yellow" : ""}>
                    {l.name}
                  </div>
                </div>
                <span className="tiny faint">{l.min} XP</span>
              </div>
            );
          })}
        </div>
        <div className="tiny faint mt-8">Every finished workout = 100 XP.</div>
      </div>

      <div className="section col gap-16">
        <div className="eyebrow">About you (your coach sees this)</div>
        <label className="field">
          <span>Name</span>
          <CommitInput value={profile.full_name} onCommit={(v) => save("full_name", v)} />
        </label>
        <label className="field">
          <span>My goals</span>
          <CommitInput multiline value={profile.goals} onCommit={(v) => save("goals", v)} placeholder="What do you want to achieve?" />
        </label>
        <label className="field">
          <span>Injuries or limitations</span>
          <CommitInput multiline value={profile.injuries} onCommit={(v) => save("injuries", v)} placeholder="Anything I should know about?" />
        </label>
        <label className="field">
          <span>Equipment I have access to</span>
          <CommitInput multiline value={profile.equipment} onCommit={(v) => save("equipment", v)} placeholder="Gym, home dumbbells, bands…" />
        </label>
      </div>

      <button className="btn btn-ghost btn-block mt-24" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
