import { useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile, uploadAvatar } from "../lib/api";
import { companionLine, MOODS } from "../lib/companion";
import Companion from "../components/Companion";
import { Avatar, CommitInput, ErrorBox } from "../components/ui";
import PushToggle from "../components/PushToggle";

export default function CoachProfilePage() {
  const { profile, setProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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
    <div style={{ maxWidth: 560 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Coach</div>
          <h1 className="h1 mt-4">My profile</h1>
        </div>
      </div>

      <div className="card col gap-16">
        <div className="row gap-16">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={84} />
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            <Camera size={15} /> {busy ? "Uploading…" : "Change photo"}
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
        </div>
        <label className="field">
          <span>Name</span>
          <CommitInput
            value={profile.full_name}
            onCommit={async (v) => {
              try {
                setProfile(await updateProfile(profile.id, { full_name: v }));
              } catch (e) {
                setError(e);
              }
            }}
          />
        </label>
        <ErrorBox error={error} />
      </div>

      <div className="section">
        <PushToggle description="Messages, finished workouts and check-ins from your clients." />
      </div>

      <div className="section">
        <div className="eyebrow mb-8">How clients see you</div>
        <p className="small muted mb-12">
          Your photo is the face of the companion that greets clients every day. Expression-specific photos (cheering, proud, “come on!”) come next.
        </p>
        <Companion mood={MOODS.workoutToday} coachAvatar={profile.avatar_url}>
          {companionLine("workoutToday", { name: "Anna", workout: "Lower body strength" })}
        </Companion>
      </div>

      <button className="btn btn-ghost mt-24" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
