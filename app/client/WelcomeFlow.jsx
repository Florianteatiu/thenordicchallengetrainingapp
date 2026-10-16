import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getCoachProfile, updateProfile } from "../lib/api";
import { firstName } from "../lib/format";
import { COACH_FIRST_NAME, WELCOME_VIDEO_URL } from "../config";
import Companion from "../components/Companion";
import PushToggle from "../components/PushToggle";
import TrainingWeek from "../components/TrainingWeek";
import VideoEmbed from "../components/VideoEmbed";
import { ErrorBox, useAsync } from "../components/ui";

const GOALS = ["Get stronger", "Lose fat", "Build muscle", "Run further", "Feel fitter", "Build a habit", "Train for an event"];
const MAX_GOALS = 2;
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

// Goals are saved as "Get stronger, Run further — own words".
const GOAL_SEP = " — ";
function splitGoals(text) {
  if (!text) return { picks: [], note: "" };
  const [head, ...rest] = text.split(GOAL_SEP);
  const parts = head.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length || !parts.every((p) => GOALS.includes(p))) return { picks: [], note: text };
  return { picks: parts.slice(0, MAX_GOALS), note: rest.join(GOAL_SEP) };
}
function joinGoals(picks, note) {
  return [picks.join(", "), note.trim()].filter(Boolean).join(GOAL_SEP) || null;
}

// Top goals: at most MAX_GOALS can be ticked, so the client has to choose.
function GoalPicker({ picks, onChange }) {
  const full = picks.length >= MAX_GOALS;
  return (
    <div className="chips">
      {GOALS.map((g) => {
        const on = picks.includes(g);
        return (
          <button key={g} type="button" className={`chip${on ? " active" : ""}`} disabled={!on && full} onClick={() => onChange(on ? picks.filter((p) => p !== g) : [...picks, g])}>
            {g}
          </button>
        );
      })}
    </div>
  );
}

// First sign-in for a new client: a welcome from the coach, then goals,
// training days, injuries/equipment and notifications, all saved to their profile.
export default function WelcomeFlow() {
  const { profile, setProfile } = useAuth();
  const { data: coach } = useAsync(getCoachProfile, []);
  const [step, setStep] = useState(0);
  const [goalPicks, setGoalPicks] = useState(() => splitGoals(profile.goals).picks);
  const [goalNote, setGoalNote] = useState(() => splitGoals(profile.goals).note);
  const [week, setWeek] = useState({ perWeek: profile.training_days_per_week ?? null, days: profile.training_days ?? [] });
  const [injuries, setInjuries] = useState(profile.injuries ?? "");
  const [equipment, setEquipment] = useState(profile.equipment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = firstName(profile.full_name);
  const STEPS = 5;

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
            A few quick questions so I can build your training around you. It takes about a minute.
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="welcome-body" key="1">
          <div className="eyebrow">1 of 4</div>
          <div className="h1">What are you training for?</div>
          <div className="muted">Pick your top {MAX_GOALS} goals. Choosing helps me focus your training where it matters most.</div>
          <GoalPicker picks={goalPicks} onChange={setGoalPicks} />
          <div className="small faint">{goalPicks.length} of {MAX_GOALS} picked</div>
          <textarea className="textarea" value={goalNote} onChange={(e) => setGoalNote(e.target.value)} placeholder="In your own words (optional): first pull-up, 10 km under an hour, feel good in summer…" style={{ minHeight: 90 }} />
        </div>
      )}

      {step === 2 && (
        <div className="welcome-body" key="2">
          <div className="eyebrow">2 of 4</div>
          <div className="h1">Your training week</div>
          <div className="muted">So your plan fits your life, not the other way round.</div>
          <TrainingWeek perWeek={week.perWeek} days={week.days} onChange={setWeek} />
        </div>
      )}

      {step === 3 && (
        <div className="welcome-body" key="3">
          <div className="eyebrow">3 of 4</div>
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

      {step === 4 && (
        <div className="welcome-body" key="4">
          <div className="eyebrow">4 of 4</div>
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
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || goalPicks.length === 0} onClick={() => save({ goals: joinGoals(goalPicks, goalNote) }, 2)}>
            Next <ArrowRight size={18} />
          </button>
        )}
        {step === 2 && (
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={busy || !week.perWeek}
            onClick={() => save({ training_days_per_week: week.perWeek, training_days: week.days.length ? week.days : null }, 3)}
          >
            Next <ArrowRight size={18} />
          </button>
        )}
        {step === 3 && (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => save({ injuries: injuries.trim() || null, equipment: equipment.trim() || null }, 4)}>
            Next <ArrowRight size={18} />
          </button>
        )}
        {step === 4 && (
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
