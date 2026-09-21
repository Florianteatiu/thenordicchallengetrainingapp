import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, MessageCircle, Trophy, Search, Trash2, Plus, ChevronRight,
  Image as ImageIcon, Send, Flame, Clock, LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, ghostBtn, cardStyle, editInputStyle } from "../theme";
import logo from "../assets/logo.png";
import { fetchClientsForCoach, initialsFor, updateProfile } from "../lib/api/profiles";
import {
  fetchProgramWithExercises, createProgram, updateProgramMeta, addExercise, updateExercise, deleteExercise,
} from "../lib/api/programs";
import { fetchRecentSessions, fetchRecentSessionsForClients } from "../lib/api/workouts";
import { fetchThread, fetchLatestMessagePerClient, sendMessage, subscribeToThread, markThreadRead } from "../lib/api/messages";
import { fetchProgressPhotos } from "../lib/api/photos";
import { computeStreak, computeTodayProgress } from "../lib/stats";
import { relativeTimeLabel, relativeDayLabel, todayStr } from "../lib/dateUtils";

const moodEmoji = { Tough: "😅", Good: "🙂", Easy: "😴" };

function Avatar({ name, avatarUrl, size = 40 }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.36, flexShrink: 0 }}>
      {initialsFor(name)}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    Completed: [C.successSoft, C.success],
    "In progress": [C.signalSoft, C.signalText],
    "Not started": ["#EFEEEC", C.textSecondary],
  };
  const [bg, fg] = map[status] || map["Not started"];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: bg, color: fg }}>{status}</span>;
}

// ---------- Sidebar nav ----------
function Sidebar({ view, onNavigate, unreadTotal, coachName, onSignOut }) {
  const items = [
    { id: "clients", label: "Clients", icon: Users },
    { id: "messages", label: "Messages", icon: MessageCircle, badge: unreadTotal },
    { id: "challenge", label: "Challenge", icon: Trophy },
  ];
  return (
    <div style={{ width: 208, flexShrink: 0, background: C.ink, color: "#fff", display: "flex", flexDirection: "column", padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 22px" }}>
        <img src={logo} alt="" style={{ width: 34, height: 34, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10.5, color: "#9C9A97", fontWeight: 700, letterSpacing: 0.4 }}>THE NORDIC CHALLENGE</div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 1 }}>Coach dashboard</div>
        </div>
      </div>
      {items.map((it) => (
        <button key={it.id} onClick={() => onNavigate(it.id)} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
          padding: "10px 10px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2,
          background: view === it.id ? "rgba(255,226,52,0.14)" : "transparent",
          color: view === it.id ? C.signal : "#D8D6D2",
        }}>
          <it.icon size={16} />
          <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{it.label}</span>
          {!!it.badge && <span style={{ background: C.signal, color: C.textPrimary, fontSize: 10.5, fontWeight: 800, borderRadius: 10, padding: "1px 6px" }}>{it.badge}</span>}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 6px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <img src={logo} alt="" style={{ width: 30, height: 30, borderRadius: "50%" }} />
        <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coachName}</div>
        <button onClick={onSignOut} aria-label="Sign out" style={{ background: "none", border: "none", color: "#9C9A97", cursor: "pointer", display: "flex" }}>
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

// ---------- Client list ----------
function ClientList({ clients, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ padding: "16px 14px 10px" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.textPrimary, marginBottom: 10 }}>Clients</div>
        <div style={{ position: "relative" }}>
          <Search size={14} color={C.textMuted} style={{ position: "absolute", left: 9, top: 9 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" style={{ ...editInputStyle, padding: "7px 8px 7px 28px" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {filtered.length === 0 && <div style={{ fontSize: 12.5, color: C.textSecondary, padding: "12px 8px" }}>No clients yet.</div>}
        {filtered.map((c) => (
          <button key={c.id} onClick={() => onSelect(c.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2,
            background: selectedId === c.id ? C.paperMuted : "transparent",
          }}>
            <Avatar name={c.name} avatarUrl={c.avatar_url} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Active {relativeTimeLabel(c.last_active_at)}
              </div>
            </div>
            {c.streak > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 700, color: C.signalText }}>
                <Flame size={12} /> {c.streak}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Program editor ----------
function ProgramEditor({ program, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta, onCreate, creating }) {
  if (!program) {
    return (
      <div style={{ ...cardStyle, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13.5, color: C.textSecondary, marginBottom: 12 }}>This client doesn't have a program yet.</div>
        <button onClick={onCreate} disabled={creating} style={{ ...ghostBtn, margin: "0 auto" }}>
          <Plus size={14} /> {creating ? "Creating..." : "Create program"}
        </button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, marginBottom: 8 }}>PROGRAM DETAILS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700 }}>Week label</label>
            <input value={program.week_label} onChange={(e) => onEditMeta("week_label", e.target.value)} style={editInputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700 }}>Title</label>
            <input value={program.title} onChange={(e) => onEditMeta("title", e.target.value)} style={editInputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700 }}>Est. minutes</label>
            <input type="number" value={program.duration_min} onChange={(e) => onEditMeta("duration_min", Number(e.target.value))} style={editInputStyle} />
          </div>
        </div>
      </div>

      {program.exercises.map((ex) => (
        <div key={ex.id} style={{ ...cardStyle, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Exercise</label>
              <input value={ex.name} onChange={(e) => onEditField(ex.id, "name", e.target.value)} style={{ ...editInputStyle, fontWeight: 700 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Sets</label>
              <input type="number" value={ex.target_sets} onChange={(e) => onEditField(ex.id, "target_sets", Number(e.target.value))} style={editInputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Reps</label>
              <input value={ex.target_reps} onChange={(e) => onEditField(ex.id, "target_reps", e.target.value)} style={editInputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Weight (kg)</label>
              <input type="number" value={ex.target_weight} onChange={(e) => onEditField(ex.id, "target_weight", Number(e.target.value))} style={editInputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Rest (s)</label>
              <input type="number" value={ex.rest_seconds} onChange={(e) => onEditField(ex.id, "rest_seconds", Number(e.target.value))} style={editInputStyle} />
            </div>
            <button onClick={() => onRemove(ex.id)} style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#F3E9E9", color: "#A6403C", border: "none", borderRadius: 6, cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
          <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Form cue</label>
          <textarea value={ex.cue} onChange={(e) => onEditField(ex.id, "cue", e.target.value)} style={{ ...editInputStyle, minHeight: 36, resize: "vertical", marginBottom: 8 }} />
          <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Alternatives (comma separated)</label>
          <input value={(ex.alternatives || []).join(", ")} onChange={(e) => onEditAlternatives(ex.id, e.target.value)} style={editInputStyle} />
        </div>
      ))}

      <button onClick={onAdd} style={{ ...ghostBtn, width: "100%", justifyContent: "center", padding: "10px 0" }}>
        <Plus size={14} /> Add exercise
      </button>
    </div>
  );
}

// ---------- Activity log ----------
function ActivityLog({ sessions, programTitle, loading }) {
  if (loading) return <div style={{ fontSize: 13, color: C.textSecondary }}>Loading...</div>;
  const logged = sessions.filter((s) => (s.set_logs || []).some((sl) => sl.done));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {logged.length === 0 && <div style={{ fontSize: 13, color: C.textSecondary }}>No sessions logged yet.</div>}
      {logged.map((s) => {
        const { totalSets, doneSets } = computeTodayProgress({ all: s.set_logs || [] });
        return (
          <div key={s.id} style={{ ...cardStyle, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Clock size={15} color={C.signalText} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.textPrimary }}>{relativeDayLabel(s.session_date)}</div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>
                {programTitle} — {doneSets}/{totalSets} sets logged
                {s.mood ? `, effort: ${moodEmoji[s.mood] || ""} ${s.mood}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Messages thread ----------
function MessagesThread({ messages, onSend, coachId }) {
  const [draft, setDraft] = useState("");
  function send() {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  }
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 320, overflowY: "auto" }}>
        {messages.length === 0 && <div style={{ fontSize: 13, color: C.textSecondary }}>No messages yet.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: m.sender_id === coachId ? "flex-end" : "flex-start",
            background: m.sender_id === coachId ? C.ink : C.paperMuted,
            color: m.sender_id === coachId ? "#fff" : C.textPrimary,
            padding: "8px 12px", borderRadius: 14, maxWidth: "70%", fontSize: 13, marginLeft: m.sender_id === coachId ? "auto" : 0,
          }}>
            {m.attachment_url && (
              m.attachment_type === "video"
                ? <video src={m.attachment_url} controls style={{ width: "100%", borderRadius: 8, marginBottom: m.body ? 6 : 0 }} />
                : <img src={m.attachment_url} alt="attachment" style={{ width: "100%", borderRadius: 8, marginBottom: m.body ? 6 : 0 }} />
            )}
            {m.body}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply..." style={{ ...editInputStyle, flex: 1 }} />
        <button onClick={send} style={{ width: 36, height: 36, borderRadius: 8, background: C.signal, border: "none", color: C.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ---------- Client detail ----------
function ClientDetail({ client, program, programLoading, sessions, sessionsLoading, messages, photos, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta, onCreateProgram, creatingProgram, onSendMessage, coachId }) {
  const [tab, setTab] = useState("program");
  const tabs = [
    { id: "program", label: "Program" },
    { id: "activity", label: "Activity" },
    { id: "messages", label: "Messages" },
    { id: "photos", label: "Photos" },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <Avatar name={client.name} avatarUrl={client.avatar_url} size={46} />
        <div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.textPrimary }}>{client.name}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary }}>Last active {relativeTimeLabel(client.last_active_at)}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><StatusPill status={client.todayStatus} /></div>
      </div>

      <div style={{ display: "flex", gap: 6, margin: "18px 0 18px" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            background: tab === t.id ? C.ink : C.paperMuted, color: tab === t.id ? "#fff" : C.textSecondary,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 640 }}>
        {tab === "program" && (
          programLoading
            ? <div style={{ fontSize: 13, color: C.textSecondary }}>Loading...</div>
            : <ProgramEditor program={program} onEditField={onEditField} onEditAlternatives={onEditAlternatives} onRemove={onRemove} onAdd={onAdd} onEditMeta={onEditMeta} onCreate={onCreateProgram} creating={creatingProgram} />
        )}
        {tab === "activity" && <ActivityLog sessions={sessions} programTitle={program?.title || "Workout"} loading={sessionsLoading} />}
        {tab === "messages" && <MessagesThread messages={messages} onSend={onSendMessage} coachId={coachId} />}
        {tab === "photos" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {photos.length === 0 && <div style={{ fontSize: 13, color: C.textSecondary }}>No photos submitted yet.</div>}
            {photos.map((p) => (
              <a key={p.id} href={p.signedUrl} target="_blank" rel="noopener noreferrer" style={{ width: 100, height: 100, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line}`, display: "block" }}>
                {p.signedUrl ? <img src={p.signedUrl} alt="progress" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color={C.textMuted} />}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Messages inbox (all clients) ----------
function MessagesInbox({ clients, latestByClient, onOpenClient }) {
  const rows = clients
    .filter((c) => latestByClient[c.id])
    .map((c) => ({ client: c, last: latestByClient[c.id] }));
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ fontSize: 21, fontWeight: 900, color: C.textPrimary, marginBottom: 16 }}>Messages</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
        {rows.length === 0 && <div style={{ fontSize: 13, color: C.textSecondary }}>No conversations yet.</div>}
        {rows.map(({ client, last }) => (
          <button key={client.id} onClick={() => onOpenClient(client.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", width: "100%" }}>
            <Avatar name={client.name} avatarUrl={client.avatar_url} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{client.name}</div>
              <div style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {last.sender_id !== client.id ? "You: " : ""}{last.body || "(attachment)"}
              </div>
            </div>
            {last.sender_id === client.id && !last.read_at && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.signal, flexShrink: 0 }} />}
            <ChevronRight size={16} color={C.textMuted} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Challenge tracker ----------
function ChallengeTracker({ clients, onToggleJoined }) {
  const joinedCount = clients.filter((c) => c.joined_challenge).length;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ fontSize: 21, fontWeight: 900, color: C.textPrimary, marginBottom: 4 }}>This month's challenge</div>
      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6 }}>Bike week · Oct 5–9 · Gothenburg</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.signalText, marginBottom: 18 }}>{joinedCount}/{clients.length} clients joined</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
        {clients.map((c) => (
          <div key={c.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
            <Avatar name={c.name} avatarUrl={c.avatar_url} size={34} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{c.name}</div>
            <button onClick={() => onToggleJoined(c.id, !c.joined_challenge)} style={{
              fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer",
              background: c.joined_challenge ? C.successSoft : "#EFEEEC", color: c.joined_challenge ? C.success : C.textSecondary,
            }}>
              {c.joined_challenge ? "Joined ✓" : "Not joined"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Root dashboard ----------
export default function CoachDashboard() {
  const { profile, signOut } = useAuth();
  const coachId = profile.id;

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [view, setView] = useState("clients");
  const [selectedId, setSelectedId] = useState(null);

  const [program, setProgram] = useState(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [latestByClient, setLatestByClient] = useState({});

  const [photos, setPhotos] = useState([]);

  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    const rows = await fetchClientsForCoach(coachId);
    const clientIds = rows.map((c) => c.id);
    const sessionsByClient = await fetchRecentSessionsForClients(clientIds, sinceDate);
    const today = todayStr();
    const enriched = rows.map((c) => {
      const clientSessions = sessionsByClient[c.id] || [];
      const streak = computeStreak(clientSessions);
      const todaySession = clientSessions.find((s) => s.session_date === today);
      let todayStatus = "Not started";
      if (todaySession) {
        const { totalSets, doneSets } = computeTodayProgress({ all: todaySession.set_logs || [] });
        if (totalSets > 0 && doneSets === totalSets) todayStatus = "Completed";
        else if (doneSets > 0) todayStatus = "In progress";
      }
      return { ...c, streak, todayStatus };
    });
    setClients(enriched);
    setClientsLoading(false);
    if (!selectedId && enriched.length > 0) setSelectedId(enriched[0].id);

    const latest = await fetchLatestMessagePerClient(coachId, clientIds);
    setLatestByClient(latest);
  }, [coachId, sinceDate, selectedId]);

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  const loadClientDetail = useCallback(async (clientId) => {
    setProgramLoading(true);
    setSessionsLoading(true);
    const [prog, sess, thread, photoList] = await Promise.all([
      fetchProgramWithExercises(clientId),
      fetchRecentSessions(clientId, sinceDate),
      fetchThread(coachId, clientId),
      fetchProgressPhotos(clientId),
    ]);
    setProgram(prog);
    setProgramLoading(false);
    setSessions(sess);
    setSessionsLoading(false);
    setMessages(thread);
    setPhotos(photoList);

    if (thread.some((m) => m.sender_id === clientId && !m.read_at)) {
      await markThreadRead(coachId, clientId);
      setLatestByClient((prev) => (prev[clientId] ? { ...prev, [clientId]: { ...prev[clientId], read_at: new Date().toISOString() } } : prev));
    }
  }, [coachId, sinceDate]);

  useEffect(() => {
    if (selectedId) loadClientDetail(selectedId);
  }, [selectedId, loadClientDetail]);

  useEffect(() => {
    if (!selectedId) return;
    return subscribeToThread(coachId, selectedId, (m) => setMessages((prev) => [...prev, m]));
  }, [coachId, selectedId]);

  const unreadTotal = clients.filter((c) => {
    const last = latestByClient[c.id];
    return last && last.sender_id === c.id && !last.read_at;
  }).length;

  function patchLocalExercise(exId, patch) {
    setProgram((prev) => ({ ...prev, exercises: prev.exercises.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)) }));
  }

  async function editField(exId, field, value) {
    patchLocalExercise(exId, { [field]: value });
    try {
      await updateExercise(exId, { [field]: value });
    } catch (e) {
      console.error("Failed to save exercise field", e);
    }
  }

  function editAlternatives(exId, text) {
    const list = text.split(",").map((s) => s.trim()).filter(Boolean);
    editField(exId, "alternatives", list);
  }

  async function removeExercise(exId) {
    setProgram((prev) => ({ ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exId) }));
    try {
      await deleteExercise(exId);
    } catch (e) {
      console.error("Failed to delete exercise", e);
    }
  }

  async function handleAddExercise() {
    const orderIndex = program.exercises.length;
    const created = await addExercise(program.id, orderIndex);
    setProgram((prev) => ({ ...prev, exercises: [...prev.exercises, created] }));
  }

  async function editMeta(field, value) {
    setProgram((prev) => ({ ...prev, [field]: value }));
    try {
      await updateProgramMeta(program.id, { [field]: value });
    } catch (e) {
      console.error("Failed to save program field", e);
    }
  }

  async function handleCreateProgram() {
    setCreatingProgram(true);
    try {
      const created = await createProgram({
        coachId,
        clientId: selectedId,
        weekLabel: "Week 1 · Day 1",
        title: "New program",
        durationMin: 45,
      });
      setProgram(created);
    } finally {
      setCreatingProgram(false);
    }
  }

  async function handleSendMessage(text) {
    const msg = await sendMessage({ senderId: coachId, recipientId: selectedId, text });
    setMessages((prev) => [...prev, msg]);
    setLatestByClient((prev) => ({ ...prev, [selectedId]: msg }));
  }

  async function toggleJoined(clientId, joined) {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, joined_challenge: joined } : c)));
    try {
      await updateProfile(clientId, { joined_challenge: joined });
    } catch (e) {
      console.error("Failed to update challenge status", e);
    }
  }

  const selected = clients.find((c) => c.id === selectedId);

  if (clientsLoading) {
    return (
      <div style={{ fontFamily: fontStack, display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.paperMuted }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontStack, display: "flex", height: "100vh", background: C.paperMuted, overflow: "hidden" }}>
      <Sidebar view={view} onNavigate={setView} unreadTotal={unreadTotal} coachName={profile.name} onSignOut={signOut} />

      {view === "clients" && (
        clients.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary, fontSize: 14 }}>
            No clients yet — share a signup link with your athletes and they'll show up here.
          </div>
        ) : (
          <>
            <ClientList clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
            {selected && (
              <ClientDetail
                client={selected}
                program={program}
                programLoading={programLoading}
                sessions={sessions}
                sessionsLoading={sessionsLoading}
                messages={messages}
                photos={photos}
                onEditField={editField}
                onEditAlternatives={editAlternatives}
                onRemove={removeExercise}
                onAdd={handleAddExercise}
                onEditMeta={editMeta}
                onCreateProgram={handleCreateProgram}
                creatingProgram={creatingProgram}
                onSendMessage={handleSendMessage}
                coachId={coachId}
              />
            )}
          </>
        )
      )}

      {view === "messages" && (
        <MessagesInbox clients={clients} latestByClient={latestByClient} onOpenClient={(id) => { setSelectedId(id); setView("clients"); }} />
      )}

      {view === "challenge" && (
        <ChallengeTracker clients={clients} onToggleJoined={toggleJoined} />
      )}
    </div>
  );
}
