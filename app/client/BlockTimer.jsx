import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Plus, SkipForward, X } from "lucide-react";
import { formatClock } from "../lib/format";
import { go, keepAwake, tick, unlockAudio, vibrate } from "../lib/sound";

const GET_READY = 10;

// Turns a timed block into a list of phases the timer walks through.
function buildPhases(block) {
  const items = block.items;
  const itemAt = (i) => items.length ? items[i % items.length] : null;
  const phases = [{ kind: "ready", label: "Get ready", sec: GET_READY, item: itemAt(0) }];
  if (block.format === "intervals") {
    const rounds = block.rounds || 8;
    for (let r = 0; r < rounds; r++) {
      phases.push({ kind: "work", label: "Work", sec: block.work_sec || 40, item: itemAt(r), round: r + 1, of: rounds });
      if (block.rest_sec && r < rounds - 1) phases.push({ kind: "rest", label: "Rest", sec: block.rest_sec, item: itemAt(r + 1), round: r + 1, of: rounds });
    }
  } else if (block.format === "emom") {
    const minutes = block.rounds || 10;
    for (let m = 0; m < minutes; m++) phases.push({ kind: "work", label: `Minute ${m + 1}`, sec: 60, item: itemAt(m), round: m + 1, of: minutes });
  } else if (block.format === "amrap") {
    phases.push({ kind: "work", label: "AMRAP", sec: block.time_cap_sec || 600, item: null });
  }
  return phases;
}

// Full-screen timer. Countdown formats (intervals, EMOM, AMRAP) run through
// phases; circuits run a stopwatch with a round counter.
export default function BlockTimer({ block, onClose, onFinish }) {
  const stopwatch = block.format === "circuit";
  const phases = useMemo(() => (stopwatch ? [] : buildPhases(block)), [block, stopwatch]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds in current phase (or total for stopwatch)
  const [rounds, setRounds] = useState(0);
  const [finished, setFinished] = useState(false);
  const lastTick = useRef(Date.now());
  const lastBeep = useRef(null);

  useEffect(() => {
    unlockAudio();
    let lock;
    keepAwake().then((l) => (lock = l));
    return () => lock?.release?.();
  }, []);

  useEffect(() => {
    if (!running || finished) return;
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      setElapsed((e) => e + dt);
    }, 200);
    return () => clearInterval(id);
  }, [running, finished]);

  const phase = phases[phaseIdx];
  const remaining = phase ? phase.sec - elapsed : 0;

  // Phase transitions and countdown beeps.
  useEffect(() => {
    if (stopwatch || finished || !phase) return;
    const secLeft = Math.ceil(remaining);
    if (secLeft <= 3 && secLeft > 0 && lastBeep.current !== `${phaseIdx}-${secLeft}`) {
      lastBeep.current = `${phaseIdx}-${secLeft}`;
      tick();
    }
    if (remaining <= 0) {
      if (phaseIdx < phases.length - 1) {
        go();
        vibrate(200);
        setPhaseIdx((i) => i + 1);
        setElapsed(0);
      } else {
        go();
        vibrate();
        setFinished(true);
      }
    }
  }, [remaining, phaseIdx, phases.length, phase, stopwatch, finished]);

  const totalWork = phases.filter((p) => p.kind !== "ready").reduce((n, p) => n + p.sec, 0);
  const elapsedTotal = phases.slice(1, phaseIdx).reduce((n, p) => n + p.sec, 0) + (phase?.kind === "ready" ? 0 : elapsed);

  function skip() {
    if (phaseIdx < phases.length - 1) {
      setPhaseIdx((i) => i + 1);
      setElapsed(0);
    } else setFinished(true);
  }

  function done() {
    if (stopwatch) onFinish({ duration_sec: Math.round(elapsed), rounds });
    else if (block.format === "intervals" || block.format === "emom") onFinish({ rounds: phase?.round ?? block.rounds, duration_sec: Math.round(elapsedTotal) });
    else onFinish({ duration_sec: Math.round(elapsedTotal) });
  }

  const isRest = phase?.kind === "rest" || phase?.kind === "ready";
  const ringColor = finished ? "var(--green)" : isRest ? "var(--text-3)" : "var(--yellow)";
  const fraction = stopwatch ? (elapsed % 60) / 60 : phase ? Math.max(0, remaining) / phase.sec : 0;
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className={`timer-screen${isRest ? "" : " work"}`}>
      <div className="row between">
        <div className="eyebrow">{block.name || "Timer"}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close timer">
          <X size={22} />
        </button>
      </div>

      <div className="grow col" style={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
        <div className="timer-phase" style={{ color: finished ? "var(--green)" : isRest ? "var(--text-2)" : "var(--yellow)" }}>
          {finished ? "Done!" : stopwatch ? `Round ${rounds + 1}${block.rounds ? ` of ${block.rounds}` : ""}` : phase.label}
          {!finished && phase?.round && <span className="faint" style={{ fontSize: 20 }}> · {phase.round}/{phase.of}</span>}
        </div>

        <div className="timer-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
            <circle
              cx="50" cy="50" r={R} fill="none" stroke={ringColor} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - fraction)}
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
          </svg>
          <div className="inner">
            <div className="timer-clock">{formatClock(stopwatch ? elapsed : finished ? 0 : Math.ceil(remaining))}</div>
          </div>
        </div>

        {!finished && (
          <div className="center" style={{ minHeight: 60 }}>
            {stopwatch || block.format === "amrap" ? (
              <div className="col gap-4">
                {block.items.map((it) => (
                  <div key={it.id} className="small">
                    <b>{it.reps || (it.duration_sec ? formatClock(it.duration_sec) : "")}</b> {it.exercise?.name}
                  </div>
                ))}
              </div>
            ) : phase?.item ? (
              <>
                <div className="eyebrow">{phase.kind === "work" ? "Now" : "Next"}</div>
                <div className="h2 mt-4">{phase.item.exercise?.name}</div>
                {phase.item.reps && <div className="muted">{phase.item.reps} reps</div>}
              </>
            ) : null}
          </div>
        )}
        {!stopwatch && !finished && <div className="tiny faint">Total {formatClock(elapsedTotal)} / {formatClock(totalWork)}</div>}
      </div>

      {finished ? (
        <button className="btn btn-primary btn-lg btn-block" onClick={done}>
          Log result
        </button>
      ) : stopwatch ? (
        <div className="col">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => { setRounds((r) => r + 1); tick(); }}>
            <Plus size={20} /> Round done
          </button>
          <div className="row">
            <button className="btn btn-block" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={18} /> : <Play size={18} />} {running ? "Pause" : "Resume"}
            </button>
            <button className="btn btn-block btn-ghost" onClick={() => { setFinished(true); setRunning(false); }}>
              Finish
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn btn-lg btn-block" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause size={20} /> : <Play size={20} />} {running ? "Pause" : "Resume"}
          </button>
          <button className="btn btn-lg btn-ghost" onClick={skip} aria-label="Skip">
            <SkipForward size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
