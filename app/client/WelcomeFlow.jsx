import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getCoachProfile, updateProfile } from "../lib/api";
import { firstName } from "../lib/format";
import { COACH_FIRST_NAME, WELCOME_VIDEO_URL } from "../config";
import Companion from "../components/Companion";
import PushToggle from "../components/PushToggle";
import VideoEmbed from "../components/VideoEmbed";
import { ErrorBox, useAsync } from "../components/ui";

const GOALS = ["Get stronger", "Lose fat", "Build muscle", "Run further", "Feel fitter", "Build a habit", "Train for an event"];
const EQUIPMENT = ["Full gym", "Home dumbbells", "Kettlebell", "Bands", "Bodyweight only", "Pool access", "Bike"];

// Adds or removes a quick-pick phrase in a comma-separated text.
function togglePhrase(text, phrase) {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const next = parts.includes(phrase) ? parts.filter((p) => p !== phrase) : [...parts, phrase];
  return next.join(", ");
}

function Chips({ options, text, onChange }) {
  const parts = text.split(",").map((p) => p.trim());
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={`chip${parts.includes(o) ? " active" : ""}`} onClick={() => onChange(togglePhrase(text, o))}>
          {o}
        </button>
      ))}
    </div>
  );
}

// First sign-in for a new client: a welcome from the coach, then goals,
// injuries/equipment and notifications, all saved to their profile.
export default function WelcomeFlow() {
  const { profile, setProfile } = useAuth();
  const { data: coach } = useAsync(getCoachProfile, []);
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState(profile.goals ?? "");
  const [injuries, setInjuries] = useState(profile.injuries ?? "");
  const [equipment, setEquipment] = useState(profile.equipment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = firstName(profile.full_name);
  const STEPS = 4;

  async function save(patch, next) {
    setBusy(true);
    setError(null);
    try {
      const saved = await updateProfile(profile.id, patch);
      if (next === "done") setProfile(saved);
      else setStep(next);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-dots">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>

      {step === 0 && (
        <div className="welcome-body" key="0">
          <div className="eyebrow">The Nordic Challenge</div>
          <div className="h1">Welcome, {name || "athlete"}!</div>
          {WELCOME_VIDEO_URL ? (
            <VideoEmbed url={WELCOME_VIDEO_URL} />
          ) : (
            <Companion large mood="wave" coachAvatar={coach?.avatar_url}>
              I'm {COACH_FIRST_NAME}. I crossed Sweden by swimming, cycling and running, and now I'm here to help you go further than you think you
              can. No level required. Just show up, and I'll take care of the plan.
            </Companion>
          )}
          <div className="muted">
            Three quick questions so I can build your training around you. It takes about a minute.
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="welcome-body" key="1">
          <div className="eyebrow">1 of 3</div>
          <div className="h1">What are you training for?</div>
          <Chips options={GOALS} text={goals} onChange={setGoals} />
          <textarea className="textarea" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="In your own words: first pull-up, 10 km under an hour, feel good in summer…" style={{ minHeight: 110 }} />
        </div>
      )}

      {step === 2 && (
        <div className="welcome-body" key="2">
          <div className="eyebrow">2 of 3</div>
          <div className="h1">Your body & your kit</div>
          <label className="field">
            <span>Any injuries or things to be careful with?</span>
            <textarea className="textarea" value={injuries} onChange={(e) => setInjuries(e.target.value)} placeholder="e.g. old knee injury, lower back gets tight. Leave empty if none." />
          </label>
          <div className="field">
            <span>What can you train with?</span>
            <Chips options={EQUIPMENT} text={equipment} onChange={setEquipment} />
          </div>
          <textarea className="textarea" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Anything else?" />
        </div>
      )}

      {step === 3 && (
        <div className="welcome-body" key="3">
          <div className="eyebrow">3 of 3</div>
          <div className="h1">Stay in the loop</div>
          <div className="muted">
            Get a nudge on training days, and know straight away when {COACH_FIRST_NAME} replies or comments on your workout.
          </div>
          <PushToggle description="Training reminders and messages from your coach." />
          <div className="card row" style={{ alignItems: "flex-start" }}>
            <Check size={18} className="green" style={{ marginTop: 2 }} />
            <div className="small">
              You can change this any time from the <b>Me</b> page.
            </div>
          </div>
        </div>
      )}

      <ErrorBox error={error} />
      <div className="welcome-foot">
        {step === 0 && (
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(1)}>
            Let's go <ArrowRight size={18} />
          </button>
        )}
        {step === 1 && (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => save({ goals: goals.trim() || null }, 2)}>
            Next <ArrowRight size={18} />
          </button>
        )}
        {step === 2 && (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => save({ injuries: injuries.trim() || null, equipment: equipment.trim() || null }, 3)}>
            Next <ArrowRight size={18} />
          </button>
        )}
        {step === 3 && (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => save({ onboarded_at: new Date().toISOString() }, "done")}>
            {busy ? "One moment…" : "Start training"}
          </button>
        )}
        {step > 0 && (
          <button className="btn btn-ghost btn-block" onClick={() => setStep(step - 1)} disabled={busy}>
            Back
          </button>
        )}
      </div>
    </div>
  );
}
