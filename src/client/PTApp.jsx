import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play, RefreshCw, MessageCircle, Mail, Phone, Check, Plus, Clock,
  ChevronDown, ChevronUp, Send, Pause, SkipForward, Home as HomeIcon,
  Dumbbell, Lightbulb, Flame, Trophy, Award, Paperclip, X, Globe,
  AtSign, Video, Music2, Activity, MapPin, TrendingUp, ThumbsUp,
  Sparkles, Share2, Camera, LogOut,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, ghostBtn, inputStyle, smallDarkBtnStyle, cardStyle } from "../theme";
import logo from "../assets/logo.png";
import { fetchProfileById, updateProfile, uploadAvatar, touchLastActive, initialsFor } from "../lib/api/profiles";
import { fetchProgramWithExercises, updateExercise } from "../lib/api/programs";
import {
  getOrCreateTodaySession, ensureSetLogsForExercises, updateSetLog, addExtraSet,
  updateSessionMood, setSessionCompleted, awardXPOnce, fetchRecentSessions, fetchExerciseHistory,
} from "../lib/api/workouts";
import { fetchThread, sendMessage, subscribeToThread } from "../lib/api/messages";
import { fetchProgressPhotos, uploadProgressPhoto } from "../lib/api/photos";
import {
  computeStreak, computeWeeklyDone, computeWeekVolume, computeWeekPRCount,
  computePreviousBestByExercise, computeTodayProgress, buildHeatmapCells,
} from "../lib/stats";
import { todayStr } from "../lib/dateUtils";

const quotes = [
  "Tomorrow is the best excuse ever invented. Today is more fun.",
  "You don't need to be fast. You need to show up.",
  "One set at a time. That's the whole plan.",
  "No level required, no minimum distance — just today's session.",
  "Show up for the version of you that's still becoming.",
];

const tips = [
  { pattern: "Squat", do: "Sit back like you're lowering onto a chair, chest tall.", avoid: "Letting your knees shoot forward past your toes before your hips move." },
  { pattern: "Hinge (deadlift / RDL)", do: "Push your hips back first, keep the bar close to your legs.", avoid: "Rounding your lower back to reach the floor." },
  { pattern: "Press (bench / overhead)", do: "Keep your ribs stacked over your hips, brace your core.", avoid: "Flaring your elbows to 90° or arching your lower back hard." },
  { pattern: "Pull (row / pulldown)", do: "Lead with your elbows, squeeze your shoulder blades together.", avoid: "Using momentum or yanking the weight with your lower back." },
  { pattern: "Core / plank", do: "Keep a straight line from shoulders to heels, ribs pulled down.", avoid: "Letting your hips sag or pike up toward the ceiling." },
];

const socialLinks = [
  { label: "thenordicchallenge.se", icon: Globe, href: "https://thenordicchallenge.se" },
  { label: "Instagram", icon: AtSign, href: "https://www.instagram.com/florianteatiu/" },
  { label: "TikTok", icon: Music2, href: "https://www.tiktok.com/@florianteatiu" },
  { label: "YouTube", icon: Video, href: "https://www.youtube.com/@florianteatiu" },
  { label: "Strava — Season 1", icon: Activity, href: "https://strava.app.link/1EwRS05082b" },
];

const upcomingEvents = [
  { date: "Oct 5–9", label: "Bike week", note: "Stationary bikes, Gothenburg" },
  { date: "Oct 12", label: "Run week", note: "Monday to Friday" },
  { date: "Oct 17", label: "8-hour swim", note: "7:00–15:00" },
  { date: "Oct 22", label: "Documentary screening", note: "Hotel Flora" },
  { date: "Oct 26", label: "Roller-ski week", note: "From Monday" },
  { date: "Nov 4", label: "Flora Running Club", note: "First Wednesday, monthly" },
];

const moodOptions = [
  { emoji: "😅", label: "Tough" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😴", label: "Easy" },
];

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.start();
    o.stop(ctx.currentTime + 0.46);
  } catch (e) { /* audio not available */ }
}
function vibrateDevice() {
  try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) { /* not supported */ }
}

// ---------- Shared bits ----------
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 0 7px", background: "none", border: "none", cursor: "pointer", color: active ? C.ink : "#A6A4A0" }}>
      <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{label}</span>
      <div style={{ width: 16, height: 2.5, borderRadius: 2, background: active ? C.signalText : "transparent", marginTop: 1 }} />
    </button>
  );
}

function Pill({ children, tone = "steel" }) {
  const map = {
    signal: [C.signalSoft, C.signalText],
    success: [C.successSoft, C.success],
    steel: ["#EFEEEC", C.textSecondary],
  };
  const [bg, fg] = map[tone];
  return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: bg, color: fg, letterSpacing: 0.2 }}>{children}</span>;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Floating rest timer ----------
function RestTimerBar({ seconds, running, onPause, onResume, onSkip, onAdd15 }) {
  return (
    <div style={{ background: C.ink, color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Clock size={18} color={C.signal} />
        <div>
          <div style={{ fontSize: 10.5, color: C.textOnDarkMuted, fontWeight: 600 }}>Rest</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatClock(seconds)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onAdd15} style={smallDarkBtnStyle}>+15s</button>
        <button onClick={running ? onPause : onResume} style={smallDarkBtnStyle}>{running ? <Pause size={15} /> : <Play size={15} />}</button>
        <button onClick={onSkip} style={smallDarkBtnStyle}><SkipForward size={15} /></button>
      </div>
    </div>
  );
}

// ---------- Thumbs-up + spark celebration ----------
function CelebrationOverlay() {
  const sparkPositions = [
    { top: "8%", left: "50%" }, { top: "28%", left: "14%" }, { top: "28%", left: "86%" },
    { top: "72%", left: "18%" }, { top: "72%", left: "82%" }, { top: "88%", left: "50%" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: 140, height: 140, animation: "ptPop 2s ease forwards" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ThumbsUp size={56} color={C.signal} fill={C.signal} strokeWidth={1.5} />
        </div>
        {sparkPositions.map((pos, i) => (
          <Sparkles key={i} size={16 + (i % 3) * 4} color={C.signal} fill={C.signal}
            style={{ position: "absolute", top: pos.top, left: pos.left, animation: `ptSpark 2s ease ${i * 0.08}s forwards` }} />
        ))}
      </div>
    </div>
  );
}

// ---------- History modal ----------
function HistoryModal({ exercise, history, onClose }) {
  if (!exercise) return null;
  const data = history || [];
  const latest = data[data.length - 1]?.weight;
  const first = data[0]?.weight;
  const gain = latest && first ? latest - first : 0;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 360, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{exercise.name}</div>
            <div style={{ fontSize: 12, color: C.textSecondary }}>Top-set weight over time</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSecondary }}><X size={18} /></button>
        </div>
        {data.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textSecondary, padding: "20px 0", textAlign: "center" }}>No history yet for this exercise.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: C.paperMuted, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700 }}>Current best</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{latest} kg</div>
              </div>
              <div style={{ background: C.paperMuted, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700 }}>Since {first !== undefined ? data[0].date : "-"}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: gain >= 0 ? C.success : C.signalText }}>{gain >= 0 ? "+" : ""}{gain} kg</div>
              </div>
            </div>
            <div style={{ width: "100%", height: 170 }}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${C.line}` }} />
                  <Line type="monotone" dataKey="weight" stroke={C.signalText} strokeWidth={2.5} dot={{ r: 3, fill: C.signalText }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Video modal ----------
function VideoModal({ exercise, onClose }) {
  if (!exercise) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 360, overflow: "hidden" }}>
        <div style={{ background: C.ink, aspectRatio: "16/10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.textOnDarkMuted, gap: 8 }}>
          <Play size={34} color={C.signal} />
          <div style={{ fontSize: 12.5 }}>Demo video placeholder</div>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{exercise.name}</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>{exercise.cue}</div>
          <button onClick={onClose} style={{ ...ghostBtn, width: "100%", justifyContent: "center" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Share PR modal ----------
function SharePRModal({ pr, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!pr) return null;
  const caption = `New PR: ${pr.name} at ${pr.weight} kg 💪`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 340, overflow: "hidden" }}>
        <div style={{ background: C.ink, padding: "26px 20px", textAlign: "center" }}>
          <Trophy size={30} color={C.signal} style={{ marginBottom: 8 }} />
          <div style={{ color: C.textOnDarkMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5 }}>NEW PERSONAL RECORD</div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginTop: 6 }}>{pr.name}</div>
          <div style={{ color: C.signal, fontSize: 30, fontWeight: 900, marginTop: 2 }}>{pr.weight} kg</div>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 8 }}>
          <button onClick={copy} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>
            <Share2 size={14} /> {copied ? "Copied!" : "Copy caption"}
          </button>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Photo preview modal ----------
function PhotoModal({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 340, overflow: "hidden" }}>
        <img src={photo.signedUrl} alt="progress" style={{ width: "100%", display: "block" }} />
        <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>{new Date(photo.taken_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <button onClick={onClose} style={ghostBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Exercise card ----------
function ExerciseCard({ exercise, sets, note, prevBest, onSetChange, onToggleDone, onAddSet, onSwap, onNoteChange, onOpenVideo, onOpenHistory, onSharePR }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const displayName = exercise.swapped_to || exercise.name;

  return (
    <div style={{ background: C.paper, borderLeft: `3px solid ${C.signal}`, borderRadius: 4, marginBottom: 14, boxShadow: "0 1px 2px rgba(10,10,10,0.06)" }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            {exercise.swapped_to && <div style={{ fontSize: 11, color: "#A6A4A0", marginBottom: 2, textDecoration: "line-through" }}>{exercise.name}</div>}
            <div style={{ fontSize: 16.5, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.2 }}>{displayName}</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 3 }}>{exercise.target_sets} sets · {exercise.target_reps} reps · target {exercise.target_weight} kg</div>
          </div>
          <button onClick={() => setExpanded((e) => !e)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSecondary, padding: 4 }}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={() => onOpenVideo(exercise)} style={ghostBtn}><Play size={13} /> Demo</button>
          <button onClick={() => setSwapOpen((s) => !s)} style={ghostBtn}><RefreshCw size={13} /> Swap</button>
          <button onClick={() => onOpenHistory(exercise)} style={ghostBtn}><TrendingUp size={13} /> History</button>
        </div>

        {swapOpen && (
          <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
            {(exercise.alternatives || []).map((alt) => (
              <button key={alt} onClick={() => { onSwap(exercise.id, alt); setSwapOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "#fff", border: "none", borderBottom: `1px solid ${C.line}`, fontSize: 13.5, color: C.textPrimary, cursor: "pointer" }}>{alt}</button>
            ))}
            {exercise.swapped_to && (
              <button onClick={() => { onSwap(exercise.id, null); setSwapOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: C.paperMuted, border: "none", fontSize: 13.5, color: C.textSecondary, cursor: "pointer" }}>Revert to {exercise.name}</button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ fontSize: 12, color: C.textSecondary, fontStyle: "italic", marginBottom: 10 }}>{exercise.cue}</div>

          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 40px", gap: 8, fontSize: 11, color: "#A6A4A0", fontWeight: 700, marginBottom: 6 }}>
            <div>Set</div><div>Weight (kg)</div><div>Reps</div><div></div>
          </div>

          {sets.map((set, i) => {
            const isPR = set.done && prevBest && Number(set.weight) > prevBest;
            return (
              <div key={set.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 40px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{set.set_number}</div>
                  <input type="number" value={set.weight ?? ""} onChange={(e) => onSetChange(exercise.id, i, "weight", e.target.value)} style={inputStyle} />
                  <input type="number" placeholder={exercise.target_reps} value={set.reps ?? ""} onChange={(e) => onSetChange(exercise.id, i, "reps", e.target.value)} style={inputStyle} />
                  <button onClick={() => onToggleDone(exercise.id, i)} aria-label="Mark set complete" style={{ width: 32, height: 32, borderRadius: 6, border: `1.5px solid ${set.done ? C.success : C.line}`, background: set.done ? C.success : "#fff", color: set.done ? "#fff" : "#A6A4A0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Check size={16} />
                  </button>
                </div>
                {isPR && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Pill tone="signal"><Trophy size={11} style={{ marginRight: 3, verticalAlign: "-2px" }} />New PR</Pill>
                    <button onClick={() => onSharePR({ name: displayName, weight: set.weight })} style={{ ...ghostBtn, padding: "3px 9px", fontSize: 11 }}>
                      <Share2 size={11} /> Share
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => onAddSet(exercise.id)} style={{ ...ghostBtn, marginTop: 2 }}><Plus size={13} /> Add set</button>

          <textarea placeholder="Notes for your trainer — how did this feel?" value={note} onChange={(e) => onNoteChange(exercise.id, e.target.value)} style={{ width: "100%", marginTop: 12, minHeight: 56, resize: "vertical", border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: fontStack, boxSizing: "border-box" }} />
        </div>
      )}
    </div>
  );
}

// ---------- Calendar heatmap ----------
const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarHeatmap({ cells }) {
  const [selected, setSelected] = useState(null);
  const todayDow = new Date().getDay();
  const dayLabels = Array.from({ length: 7 }, (_, c) => weekdayShort[(todayDow - (6 - c) + 7) % 7][0]);

  const shade = (v) => {
    if (v === 0) return C.paperMuted;
    const alpha = 0.35 + v * 0.22;
    return `rgba(255, 226, 52, ${Math.min(alpha, 1)})`;
  };

  function cellInfo(i) {
    const cell = cells[i];
    const daysAgo = cells.length - 1 - i;
    const d = new Date(`${cell.date}T00:00:00`);
    const dateLabel = daysAgo === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const desc = cell.intensity === 0 ? "Rest day" : `${cell.intensity * 3} sets logged`;
    return `${dateLabel} — ${desc}`;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {dayLabels.map((l, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#A6A4A0" }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
        {cells.map((c, i) => (
          <button key={c.date} onClick={() => setSelected(i)} aria-label={cellInfo(i)} style={{
            aspectRatio: "1", borderRadius: 3, background: shade(c.intensity), padding: 0, cursor: "pointer",
            border: i === cells.length - 1 ? `1.5px solid ${C.signalText}` : selected === i ? `1.5px solid ${C.textSecondary}` : "1px solid transparent",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: C.textSecondary, minHeight: 15 }}>
          {selected !== null ? cellInfo(selected) : "Tap a day to see what happened"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 9.5, color: "#A6A4A0" }}>Less</span>
        {[0, 1, 2, 3].map((v) => (
          <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: shade(v) }} />
        ))}
        <span style={{ fontSize: 9.5, color: "#A6A4A0" }}>More</span>
      </div>
    </div>
  );
}

// ---------- Progress photos ----------
function ProgressPhotos({ photos, onAdd, onOpen }) {
  const fileRef = useRef(null);
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onAdd(file);
    e.target.value = "";
  }
  return (
    <div style={{ ...cardStyle, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary }}>Progress photos</span>
        <span style={{ fontSize: 11, color: C.textSecondary }}>{photos.length} saved</span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 8, border: `1.5px dashed ${C.line}`, background: C.paperMuted, color: C.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Camera size={18} />
        </button>
        {photos.map((p) => (
          <button key={p.id} onClick={() => onOpen(p)} style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "none", padding: 0, cursor: "pointer" }}>
            <img src={p.signedUrl} alt="progress" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Home dashboard ----------
function HomeTab({ clientName, clientPhoto, onChangePhoto, program, todayProgress, streak, weeklyDone, weeklyTarget, xpBase, xpEarnedToday, photos, onAddPhoto, onOpenPhoto, onStart, heatmapCells, weekVolume, weekPRs, badges, joinedChallenge, onToggleJoined }) {
  const photoInputRef = useRef(null);
  const dayIdx = new Date().getDate() % quotes.length;
  const { totalSets, doneSets } = todayProgress;
  const weeklyPct = weeklyTarget > 0 ? Math.round((weeklyDone / weeklyTarget) * 100) : 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const challenge = upcomingEvents[0];
  const initials = initialsFor(clientName);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChangePhoto(file);
    e.target.value = "";
  }

  const xpTarget = 300;
  const totalXp = xpBase + xpEarnedToday;
  const level = Math.floor(totalXp / xpTarget) + 1;
  const xpIntoLevel = totalXp % xpTarget;
  const xpPct = Math.round((xpIntoLevel / xpTarget) * 100);

  return (
    <div>
      <div style={{ background: C.ink, color: "#fff", padding: "22px 18px 26px", position: "relative", overflow: "hidden" }}>
        <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, opacity: 0.5 }}>
          <polyline points="0,60 40,25 80,45 120,10 160,38 200,18 240,42 280,15 320,35 360,8 400,30 400,60" fill="none" stroke={C.inkLine} strokeWidth="1.5" />
        </svg>
        <img src={logo} alt="" style={{ position: "absolute", top: 18, right: 16, width: 30, height: 30, opacity: 0.9 }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            <button onClick={() => photoInputRef.current?.click()} style={{ position: "relative", width: 46, height: 46, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }} aria-label="Change profile photo">
              {clientPhoto ? (
                <img src={clientPhoto} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>{initials}</div>
              )}
              <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: C.signal, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.ink}` }}>
                <Camera size={9} color={C.textPrimary} />
              </div>
            </button>
            <div>
              <div style={{ fontSize: 12.5, color: C.textOnDarkMuted, fontWeight: 600 }}>{today}</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginTop: 2 }}>Good to see you, {clientName.split(" ")[0]}.</div>
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: "#D8D6D2", marginTop: 10, maxWidth: 280 }}>{quotes[dayIdx]}</div>

          <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Flame size={18} color={C.signal} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>{streak} days</div>
                <div style={{ fontSize: 10.5, color: C.textOnDarkMuted }}>current streak</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `conic-gradient(${C.signal} ${weeklyPct}%, rgba(255,255,255,0.15) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.ink, fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{weeklyDone}/{weeklyTarget}</div>
              </div>
              <div style={{ fontSize: 10.5, color: C.textOnDarkMuted, maxWidth: 70 }}>workouts this week</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          {badges.length === 0 && <div style={{ fontSize: 12, color: C.textSecondary }}>Log a few workouts to start earning badges.</div>}
          {badges.map((b, i) => (
            <div key={i} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 20, padding: "6px 12px" }}>
              <b.icon size={14} color={C.signalText} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap" }}>{b.label}</span>
            </div>
          ))}
        </div>

        <div style={{ ...cardStyle, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary }}>Consistency Level {level}</span>
            <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>{xpIntoLevel}/{xpTarget} XP</span>
          </div>
          <div style={{ height: 6, background: C.paperMuted, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${xpPct}%`, height: "100%", background: C.signal, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ fontSize: 10.5, color: C.textSecondary }}>
            +8 XP per set logged, +40 for finishing a workout. This tracks showing up, not how much you lift.
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, marginBottom: 10 }}>This week</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{weeklyDone}/{weeklyTarget}</div>
              <div style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>workouts</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{weekVolume.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>kg moved</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: weekPRs > 0 ? C.signalText : C.textPrimary }}>{weekPRs}</div>
              <div style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600 }}>new PRs</div>
            </div>
          </div>
          <CalendarHeatmap cells={heatmapCells} />
        </div>

        <ProgressPhotos photos={photos} onAdd={onAddPhoto} onOpen={onOpenPhoto} />

        {program ? (
          <>
            <Pill tone="signal">{program.week_label}</Pill>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.textPrimary, letterSpacing: -0.3 }}>{program.title}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{program.duration_min}<span style={{ fontSize: 12, fontWeight: 700 }}> min</span></div>
                  <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 600 }}>estimated time</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{program.exercises.length}</div>
                  <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 600 }}>exercises</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{doneSets}/{totalSets}</div>
                  <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 600 }}>sets logged</div>
                </div>
              </div>
              <button onClick={onStart} style={{ marginTop: 14, width: "100%", background: C.signal, color: C.textPrimary, border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
                {doneSets > 0 ? "Continue workout" : "Start workout"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ ...cardStyle, padding: 16, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
            Your coach hasn't set up a program for you yet.
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.signal}`, borderRadius: 4, padding: 14, marginTop: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.signalText, letterSpacing: 0.4, marginBottom: 3 }}>THIS MONTH'S CHALLENGE</div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.textPrimary }}>{challenge.label} <span style={{ color: C.textSecondary, fontWeight: 600 }}>· {challenge.date}</span></div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2, marginBottom: 10 }}>{challenge.note} — join in with Florian.</div>
          <button onClick={onToggleJoined} style={{ background: joinedChallenge ? C.successSoft : C.signal, color: joinedChallenge ? C.success : C.textPrimary, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
            {joinedChallenge ? "You're in ✓" : "I'm in"}
          </button>
        </div>
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

// ---------- Workout tab ----------
function WorkoutTab({ program, setLogsByExercise, notesByExercise, prevBestByExercise, actions, onOpenVideo, onOpenHistory, onSharePR, moodLogged, onLogMood }) {
  const { totalSets, doneSets } = computeTodayProgress(setLogsByExercise);
  const allDone = totalSets > 0 && doneSets === totalSets;

  if (!program) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>
        Your coach hasn't set up a program for you yet.
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      <div style={{ padding: "18px 16px 4px" }}>
        <Pill tone="signal">{program.week_label}</Pill>
        <div style={{ fontSize: 23, fontWeight: 900, color: C.textPrimary, marginTop: 8, letterSpacing: -0.4 }}>{program.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: totalSets ? `${(doneSets / totalSets) * 100}%` : "0%", height: "100%", background: C.signal, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, whiteSpace: "nowrap" }}>{doneSets}/{totalSets} sets</div>
        </div>

        {allDone && !moodLogged && (
          <div style={{ ...cardStyle, marginTop: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, marginBottom: 8 }}>Workout complete — how did that feel?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {moodOptions.map((o) => (
                <button key={o.label} onClick={() => onLogMood(o)} style={{ flex: 1, background: C.paperMuted, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, color: C.textPrimary, cursor: "pointer" }}>
                  <div style={{ fontSize: 18 }}>{o.emoji}</div>{o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {allDone && moodLogged && (
          <div style={{ marginTop: 10 }}>
            <Pill tone="success"><Check size={11} style={{ marginRight: 3, verticalAlign: "-2px" }} />Sent to your coach — nice work today</Pill>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {program.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            sets={setLogsByExercise[ex.id] || []}
            note={notesByExercise[ex.id] || ""}
            prevBest={prevBestByExercise.get(ex.id)}
            onSetChange={actions.onSetChange}
            onToggleDone={actions.onToggleDone}
            onAddSet={actions.onAddSet}
            onSwap={actions.onSwap}
            onNoteChange={actions.onNoteChange}
            onOpenVideo={onOpenVideo}
            onOpenHistory={onOpenHistory}
            onSharePR={onSharePR}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Tips tab ----------
function TipsTab() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div style={{ padding: "18px 16px 24px" }}>
      <div style={{ fontSize: 23, fontWeight: 900, color: C.textPrimary, letterSpacing: -0.4, marginBottom: 4 }}>Form &amp; technique</div>
      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>What to look for, movement by movement.</div>
      {tips.map((t, i) => {
        const open = openIdx === i;
        return (
          <div key={t.pattern} style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setOpenIdx(open ? -1 : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fff", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: C.textPrimary }}>{t.pattern}</span>
              {open ? <ChevronUp size={16} color={C.textSecondary} /> : <ChevronDown size={16} color={C.textSecondary} />}
            </button>
            {open && (
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.successSoft, color: C.success, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><Check size={12} /></div>
                  <div style={{ fontSize: 13, color: C.textPrimary }}>{t.do}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F3E9E9", color: "#A6403C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><X size={12} /></div>
                  <div style={{ fontSize: 13, color: C.textPrimary }}>{t.avoid}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Connect tab ----------
function ConnectTab() {
  return (
    <div style={{ padding: "18px 16px 24px" }}>
      <div style={{ fontSize: 23, fontWeight: 900, color: C.textPrimary, letterSpacing: -0.4, marginBottom: 14 }}>Connect</div>

      <div style={{ background: C.ink, color: "#fff", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <img src={logo} alt="" style={{ width: 38, height: 38, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Florian Teatiu</div>
          <div style={{ fontSize: 12.5, color: C.textOnDarkMuted, marginTop: 4, lineHeight: 1.5 }}>
            Former professional ballet dancer, then rugby player and coach. In 2026 he became the first person to cross Sweden solo — swimming, cycling and running.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#A6A4A0", marginBottom: 8 }}>FOLLOW</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {socialLinks.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
            <l.icon size={16} color={C.signalText} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>{l.label}</span>
          </a>
        ))}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#A6A4A0", marginBottom: 8 }}>NEXT ADVENTURE</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.signal}`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 3 }}>Season 2 — The Nordic Challenge</div>
        <div style={{ fontSize: 12.5, color: C.textSecondary }}>A 2,400 km relay across Sweden, never done before. June 2027.</div>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#A6A4A0", marginBottom: 8 }}>UPCOMING IN GOTHENBURG</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {upcomingEvents.map((e) => (
          <div key={e.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
            <MapPin size={15} color={C.signalText} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{e.label} <span style={{ color: C.textSecondary, fontWeight: 600 }}>· {e.date}</span></div>
              <div style={{ fontSize: 11.5, color: C.textSecondary }}>{e.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Coach tab ----------
function CoachTab({ coach, messages, onSend, onSignOut }) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
  }

  function send() {
    if (!draft.trim() && !attachment) return;
    onSend({ text: draft.trim(), attachmentFile: attachment });
    setDraft("");
    setAttachment(null);
  }

  return (
    <div style={{ padding: "18px 16px 16px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 23, fontWeight: 900, color: C.textPrimary, letterSpacing: -0.4, flex: 1 }}>Your coach</div>
        <button onClick={onSignOut} aria-label="Sign out" style={{ background: "none", border: "none", color: C.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <img src={logo} alt="" style={{ width: 30, height: 30 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.textPrimary }}>{coach?.name || "Your coach"}</div>
          <div style={{ fontSize: 12, color: C.textSecondary }}>Your coach · usually replies same day</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <a href="tel:+15551234567" style={{ ...ghostBtn, flex: 1, justifyContent: "center", textDecoration: "none" }}><Phone size={14} /> Call</a>
        <a href={`mailto:${coach?.email || ""}?subject=Question about my program`} style={{ ...ghostBtn, flex: 1, justifyContent: "center", textDecoration: "none" }}><Mail size={14} /> Email</a>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#A6A4A0", marginBottom: 8 }}>MESSAGES</div>

      <div style={{ flex: 1, minHeight: 160, maxHeight: 230, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {messages.length === 0 && <div style={{ fontSize: 12.5, color: C.textSecondary }}>No messages yet — say hi!</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.sender_id !== coach?.id ? "flex-end" : "flex-start", background: m.sender_id !== coach?.id ? C.ink : C.paperMuted, color: m.sender_id !== coach?.id ? "#fff" : C.textPrimary, padding: "8px 12px", borderRadius: 14, maxWidth: "80%", fontSize: 13.5 }}>
            {m.attachment_url && (
              m.attachment_type === "video"
                ? <video src={m.attachment_url} controls style={{ width: "100%", borderRadius: 8, marginBottom: m.body ? 6 : 0 }} />
                : <img src={m.attachment_url} alt="attachment" style={{ width: "100%", borderRadius: 8, marginBottom: m.body ? 6 : 0 }} />
            )}
            {m.body}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {attachment && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.paperMuted, borderRadius: 8, padding: "6px 10px" }}>
          <span style={{ fontSize: 12, color: C.textSecondary, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{attachment.name}</span>
          <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSecondary }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 8, background: C.paperMuted, border: "none", color: C.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} aria-label="Attach photo or video">
          <Paperclip size={16} />
        </button>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${coach?.name?.split(" ")[0] || "your coach"}...`} style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button onClick={send} style={{ width: 40, height: 40, borderRadius: 8, background: C.signal, border: "none", color: C.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} aria-label="Send message">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------- Root app ----------
export default function PTApp() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [coach, setCoach] = useState(null);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(null);
  const [setLogsByExercise, setSetLogsByExercise] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);

  const [tab, setTab] = useState("home");
  const [videoExercise, setVideoExercise] = useState(null);
  const [historyExercise, setHistoryExercise] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [sharePR, setSharePR] = useState(null);
  const [openPhoto, setOpenPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [celebrate, setCelebrate] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timer, setTimer] = useState({ active: false, running: false, seconds: 0 });
  const intervalRef = useRef(null);
  const prevAllDoneRef = useRef(false);

  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      touchLastActive(profile.id);
      const [coachProfile, prog, recent, photoList] = await Promise.all([
        fetchProfileById(profile.coach_id),
        fetchProgramWithExercises(profile.id),
        fetchRecentSessions(profile.id, sinceDate),
        fetchProgressPhotos(profile.id),
      ]);
      if (!active) return;
      setCoach(coachProfile);
      setProgram(prog);
      setRecentSessions(recent);
      setPhotos(photoList);

      if (prog) {
        const todaySession = await getOrCreateTodaySession(profile.id, prog.id);
        const setLogs = await ensureSetLogsForExercises(todaySession.id, prog.exercises);
        if (!active) return;
        setSession(todaySession);
        setSetLogsByExercise(groupByExercise(setLogs));
      }

      if (coachProfile) {
        const thread = await fetchThread(profile.id, coachProfile.id);
        if (!active) return;
        setMessages(thread);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  useEffect(() => {
    if (!coach) return;
    return subscribeToThread(profile.id, coach.id, (m) => setMessages((prev) => [...prev, m]));
  }, [profile.id, coach]);

  function groupByExercise(rows) {
    const grouped = {};
    rows.forEach((r) => {
      if (!grouped[r.exercise_id]) grouped[r.exercise_id] = [];
      grouped[r.exercise_id].push(r);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.set_number - b.set_number));
    return grouped;
  }

  const notesByExercise = useMemo(() => {
    const notes = {};
    Object.entries(setLogsByExercise).forEach(([exId, sets]) => {
      notes[exId] = sets.find((s) => s.set_number === 1)?.note || "";
    });
    return notes;
  }, [setLogsByExercise]);

  // Live stats include today's in-progress session merged with the fetched
  // history, so the dashboard reflects sets logged in this sitting.
  const sessionsForStats = useMemo(() => {
    const today = todayStr();
    const todaySetLogs = Object.values(setLogsByExercise).flat();
    const { totalSets, doneSets } = computeTodayProgress(setLogsByExercise);
    const syntheticToday = {
      session_date: today,
      completed: totalSets > 0 && doneSets === totalSets,
      set_logs: todaySetLogs,
    };
    const withoutToday = recentSessions.filter((s) => s.session_date !== today);
    return [syntheticToday, ...withoutToday];
  }, [recentSessions, setLogsByExercise]);

  const prevBestByExercise = useMemo(() => computePreviousBestByExercise(recentSessions), [recentSessions]);
  const todayProgress = computeTodayProgress(setLogsByExercise);
  const streak = computeStreak(sessionsForStats);
  const weeklyDone = computeWeeklyDone(sessionsForStats);
  const weekVolume = computeWeekVolume(sessionsForStats);
  const weekPRs = computeWeekPRCount(sessionsForStats);
  const heatmapCells = useMemo(() => buildHeatmapCells(sessionsForStats), [sessionsForStats]);
  const allDoneWorkoutsCount = useMemo(() => recentSessions.filter((s) => s.completed).length, [recentSessions]);

  const badges = useMemo(() => {
    const list = [];
    if (streak >= 2) list.push({ label: `${streak}-day streak`, icon: Flame });
    if (weekPRs > 0) list.push({ label: "New PR this week", icon: Trophy });
    if (allDoneWorkoutsCount > 0) list.push({ label: `${allDoneWorkoutsCount} workouts logged`, icon: Award });
    return list;
  }, [streak, weekPRs, allDoneWorkoutsCount]);

  const xpEarnedToday = todayProgress.doneSets * 8 + (todayProgress.totalSets > 0 && todayProgress.doneSets === todayProgress.totalSets ? 40 : 0);
  const moodLoggedToday = !!session?.mood;

  useEffect(() => {
    if (timer.active && timer.running) {
      intervalRef.current = setInterval(() => {
        setTimer((t) => {
          if (t.seconds <= 1) {
            clearInterval(intervalRef.current);
            playChime();
            vibrateDevice();
            return { ...t, seconds: 0, running: false, active: false };
          }
          return { ...t, seconds: t.seconds - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer.active, timer.running]);

  // Detect "all sets done" transitions: celebrate, persist completion, award XP once.
  useEffect(() => {
    if (!session) return;
    const allDone = todayProgress.totalSets > 0 && todayProgress.doneSets === todayProgress.totalSets;
    if (allDone && !prevAllDoneRef.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2000);
      prevAllDoneRef.current = true;
      if (!session.completed) setSessionCompleted(session.id, true).then((s) => setSession(s));
      awardXPOnce(session, profile.id, xpEarnedToday).then((updated) => {
        if (updated) refreshProfile();
      });
      return () => clearTimeout(t);
    }
    if (!allDone) {
      prevAllDoneRef.current = false;
      if (session.completed) setSessionCompleted(session.id, false).then((s) => setSession(s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayProgress.doneSets, todayProgress.totalSets]);

  function startTimer(seconds) {
    clearInterval(intervalRef.current);
    setTimer({ active: true, running: true, seconds });
  }

  function patchSetLocal(exId, idx, patch) {
    setSetLogsByExercise((prev) => ({
      ...prev,
      [exId]: prev[exId].map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  const actions = {
    onSetChange: (exId, idx, field, value) => {
      patchSetLocal(exId, idx, { [field]: value });
      const row = setLogsByExercise[exId][idx];
      updateSetLog(row.id, { [field]: value === "" ? null : value }).catch((e) => console.error("Failed to save set", e));
    },
    onToggleDone: (exId, idx) => {
      const row = setLogsByExercise[exId][idx];
      const nextDone = !row.done;
      patchSetLocal(exId, idx, { done: nextDone });
      updateSetLog(row.id, { done: nextDone }).catch((e) => console.error("Failed to save set", e));
      if (nextDone) {
        const ex = program.exercises.find((e) => e.id === exId);
        startTimer(ex.rest_seconds);
      }
    },
    onAddSet: async (exId) => {
      const sets = setLogsByExercise[exId];
      const last = sets[sets.length - 1];
      const created = await addExtraSet(session.id, exId, sets.length + 1, last.weight);
      setSetLogsByExercise((prev) => ({ ...prev, [exId]: [...prev[exId], created] }));
    },
    onSwap: async (exId, altName) => {
      setProgram((prev) => ({ ...prev, exercises: prev.exercises.map((ex) => (ex.id === exId ? { ...ex, swapped_to: altName } : ex)) }));
      try {
        await updateExercise(exId, { swapped_to: altName });
      } catch (e) {
        console.error("Failed to save swap", e);
      }
    },
    onNoteChange: (exId, text) => {
      setSetLogsByExercise((prev) => ({
        ...prev,
        [exId]: prev[exId].map((s) => (s.set_number === 1 ? { ...s, note: text } : s)),
      }));
      const firstSet = setLogsByExercise[exId].find((s) => s.set_number === 1);
      if (firstSet) updateSetLog(firstSet.id, { note: text }).catch((e) => console.error("Failed to save note", e));
    },
    onPauseTimer: () => setTimer((t) => ({ ...t, running: false })),
    onResumeTimer: () => setTimer((t) => ({ ...t, running: true })),
    onSkipTimer: () => setTimer({ active: false, running: false, seconds: 0 }),
    onAdd15: () => setTimer((t) => ({ ...t, seconds: t.seconds + 15 })),
  };

  async function logMood(option) {
    const updated = await updateSessionMood(session.id, option.label);
    setSession(updated);
    if (coach) {
      const msg = await sendMessage({ senderId: profile.id, recipientId: coach.id, text: `Effort today: ${option.emoji} ${option.label}` });
      setMessages((m) => [...m, msg]);
    }
  }

  async function handleSendMessage({ text, attachmentFile }) {
    if (!coach) return;
    const msg = await sendMessage({ senderId: profile.id, recipientId: coach.id, text, attachmentFile });
    setMessages((m) => [...m, msg]);
  }

  async function handleChangeAvatar(file) {
    const url = await uploadAvatar(profile.id, file);
    await refreshProfile();
    return url;
  }

  async function handleAddPhoto(file) {
    const photo = await uploadProgressPhoto(profile.id, file);
    setPhotos((prev) => [...prev, photo]);
  }

  async function handleToggleChallenge() {
    const next = !profile.joined_challenge;
    await updateProfile(profile.id, { joined_challenge: next });
    await refreshProfile();
  }

  async function openHistory(exercise) {
    setHistoryExercise(exercise);
    const data = await fetchExerciseHistory(exercise.id);
    setHistoryData(data);
  }

  if (loading) {
    return (
      <div style={{ fontFamily: fontStack, maxWidth: 400, margin: "0 auto", minHeight: 680, display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary }}>
        Loading your program...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontStack, maxWidth: 400, margin: "0 auto", background: C.paperMuted, minHeight: 680, display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.line}`, position: "relative" }}>
      <style>{`
        @keyframes ptPop {
          0% { transform: scale(0.3); opacity: 0; }
          15% { transform: scale(1.12); opacity: 1; }
          25% { transform: scale(1); opacity: 1; }
          82% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        @keyframes ptSpark {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          30% { transform: scale(1.2) rotate(20deg); opacity: 1; }
          70% { transform: scale(1) rotate(-10deg); opacity: 1; }
          100% { transform: scale(0.4) rotate(0deg); opacity: 0; }
        }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "home" && (
          <HomeTab
            clientName={profile.name}
            clientPhoto={profile.avatar_url}
            onChangePhoto={handleChangeAvatar}
            program={program}
            todayProgress={todayProgress}
            streak={streak}
            weeklyDone={weeklyDone}
            weeklyTarget={profile.weekly_target}
            xpBase={profile.xp_base}
            xpEarnedToday={xpEarnedToday}
            photos={photos}
            onAddPhoto={handleAddPhoto}
            onOpenPhoto={setOpenPhoto}
            onStart={() => setTab("workout")}
            heatmapCells={heatmapCells}
            weekVolume={weekVolume}
            weekPRs={weekPRs}
            badges={badges}
            joinedChallenge={profile.joined_challenge}
            onToggleJoined={handleToggleChallenge}
          />
        )}
        {tab === "workout" && (
          <WorkoutTab
            program={program}
            setLogsByExercise={setLogsByExercise}
            notesByExercise={notesByExercise}
            prevBestByExercise={prevBestByExercise}
            actions={actions}
            onOpenVideo={setVideoExercise}
            onOpenHistory={openHistory}
            onSharePR={setSharePR}
            moodLogged={moodLoggedToday}
            onLogMood={logMood}
          />
        )}
        {tab === "tips" && <TipsTab />}
        {tab === "connect" && <ConnectTab />}
        {tab === "coach" && <CoachTab coach={coach} messages={messages} onSend={handleSendMessage} onSignOut={signOut} />}
      </div>

      {timer.active && (
        <RestTimerBar seconds={timer.seconds} running={timer.running} onPause={actions.onPauseTimer} onResume={actions.onResumeTimer} onSkip={actions.onSkipTimer} onAdd15={actions.onAdd15} />
      )}

      <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, background: "#fff" }}>
        <TabButton active={tab === "home"} onClick={() => setTab("home")} icon={HomeIcon} label="Home" />
        <TabButton active={tab === "workout"} onClick={() => setTab("workout")} icon={Dumbbell} label="Workout" />
        <TabButton active={tab === "tips"} onClick={() => setTab("tips")} icon={Lightbulb} label="Tips" />
        <TabButton active={tab === "connect"} onClick={() => setTab("connect")} icon={Globe} label="Connect" />
        <TabButton active={tab === "coach"} onClick={() => setTab("coach")} icon={MessageCircle} label="Coach" />
      </div>

      <VideoModal exercise={videoExercise} onClose={() => setVideoExercise(null)} />
      <HistoryModal exercise={historyExercise} history={historyData} onClose={() => setHistoryExercise(null)} />
      <SharePRModal pr={sharePR} onClose={() => setSharePR(null)} />
      <PhotoModal photo={openPhoto} onClose={() => setOpenPhoto(null)} />
      {celebrate && <CelebrationOverlay />}
    </div>
  );
}
