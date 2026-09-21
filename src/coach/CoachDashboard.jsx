import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, MessageCircle, Trophy, Search, Trash2, Plus, ChevronRight,
  Image as ImageIcon, Send, Flame, Clock, LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, ghostBtn, cardStyle, editInputStyle } from "../theme";
import logo from "../assets/logo.png";
import { initialsFor } from "../lib/utils";
import { fetchClientsForCoach } from "../lib/api/clients";
import {
  fetchProgramWithExercises, createProgram, updateProgramMeta, addExercise, updateExercise, deleteExercise,
} from "../lib/api/programs";
import { fetchRecentLoggedSets, fetchRecentLoggedSetsForClients, fetchMoodCheckins, fetchMoodCheckinsForClients } from "../lib/api/workouts";
import { fetchThread, fetchLatestMessagePerClient, sendMessage, subscribeToThread } from "../lib/api/messages";
import { fetchProgressPhotos } from "../lib/api/photos";
import { relativeTimeLabel, relativeDayLabel, dateStrOf, todayStr, dayBounds } from "../lib/dateUtils";

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
            <Avatar name={c.name} avatarUrl={c.photo_url} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Active {relativeTimeLabel(c.lastActiveAt)}
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
            <input value={program.week_label || ""} onChange={(e) => onEditMeta("week_label", e.target.value)} style={editInputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700 }}>Title</label>
            <input value={program.title || ""} onChange={(e) => onEditMeta("title", e.target.value)} style={editInputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700 }}>Est. minutes</label>
            <input type="number" value={program.duration_min || 0} onChange={(e) => onEditMeta("duration_min", Number(e.target.value))} style={editInputStyle} />
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
              <input value={ex.target_reps || ""} onChange={(e) => onEditField(ex.id, "target_reps", e.target.value)} style={editInputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Weight (kg)</label>
              <input type="number" value={ex.target_weight_kg || 0} onChange={(e) => onEditField(ex.id, "target_weight_kg", Number(e.target.value))} style={editInputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Rest (s)</label>
              <input type="number" value={ex.rest_seconds || 0} onChange={(e) => onEditField(ex.id, "rest_seconds", Number(e.target.value))} style={editInputStyle} />
            </div>
            <button onClick={() => onRemove(ex.id)} style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#F3E9E9", color: "#A6403C", border: "none", borderRadius: 6, cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
          <label style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Form cue</label>
          <textarea value={ex.cue || ""} onChange={(e) => onEditField(ex.id, "cue", e.target.value)} style={{ ...editInputStyle, minHeight: 36, resize: "vertical", marginBottom: 8 }} />
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
function ActivityLog({ dailySummaries, loading }) {
  if (loading) return <div style={{ fontSize: 13, color: C.textSecondary }}>Loading...</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {dailySummaries.length === 0 && <div style={{ fontSize: 13, color: C.textSecondary }}>No sessions logged yet.</div>}
      {dailySummaries.map((day) => (
        <div key={day.date} style={{ ...cardStyle, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Clock size={15} color={C.signalText} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.textPrimary }}>{relativeDayLabel(day.date)}</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>
              {day.setCount} sets logged{day.mood ? `, effort: ${day.mood.emoji} ${day.mood.label}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Messages thread ----------
function MessagesThread({ messages, onSend }) {
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
            alignSelf: m.sender === "coach" ? "flex-end" : "flex-start",
            background: m.sender === "coach" ? C.ink : C.paperMuted,
            color: m.sender === "coach" ? "#fff" : C.textPrimary,
            padding: "8px 12px", borderRadius: 14, maxWidth: "70%", fontSize: 13, marginLeft: m.sender === "coach" ? "auto" : 0,
          }}>
            {m.attachment_url && (
              m.attachment_type === "video"
                ? <video src={m.attachment_url} controls style={{ width: "100%", borderRadius: 8, marginBottom: m.text ? 6 : 0 }} />
                : <img src={m.attachment_url} alt="attachment" style={{ width: "100%", borderRadius: 8, marginBottom: m.text ? 6 : 0 }} />
            )}
            {m.text}
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
function ClientDetail({ client, program, programLoading, dailySummaries, activityLoading, messages, photos, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta, onCreateProgram, creatingProgram, onSendMessage }) {
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
        <Avatar name={client.name} avatarUrl={client.photo_url} size={46} />
        <div>
          <div style={{ fontSize: 21, fontWeight: 900, color: C.textPrimary }}>{client.name}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary }}>Last active {relativeTimeLabel(client.lastActiveAt)}</div>
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
        {tab === "activity" && <ActivityLog dailySummaries={dailySummaries} loading={activityLoading} />}
        {tab === "messages" && <MessagesThread messages={messages} onSend={onSendMessage} />}
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
            <Avatar name={client.name} avatarUrl={client.photo_url} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{client.name}</div>
              <div style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {last.sender === "coach" ? "You: " : ""}{last.text || "(attachment)"}
              </div>
            </div>
            {last.sender === "client" && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.signal, flexShrink: 0 }} />}
            <ChevronRight size={16} color={C.textMuted} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Challenge tracker ----------
// Note: the existing schema has no column for "joined a challenge" — this is
// kept as session-only state (resets on reload) rather than adding one.
function ChallengeTracker({ clients, joinedIds, onToggleJoined }) {
  const joinedCount = clients.filter((c) => joinedIds.has(c.id)).length;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ fontSize: 21, fontWeight: 900, color: C.textPrimary, marginBottom: 4 }}>This month's challenge</div>
      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6 }}>Bike week · Oct 5–9 · Gothenburg</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.signalText, marginBottom: 18 }}>{joinedCount}/{clients.length} clients joined</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
        {clients.map((c) => (
          <div key={c.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
            <Avatar name={c.name} avatarUrl={c.photo_url} size={34} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{c.name}</div>
            <button onClick={() => onToggleJoined(c.id)} style={{
              fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer",
              background: joinedIds.has(c.id) ? C.successSoft : "#EFEEEC", color: joinedIds.has(c.id) ? C.success : C.textSecondary,
            }}>
              {joinedIds.has(c.id) ? "Joined ✓" : "Not joined"}
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
  const [joinedIds, setJoinedIds] = useState(() => new Set());

  const [program, setProgram] = useState(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);

  const [dailySummaries, setDailySummaries] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [latestByClient, setLatestByClient] = useState({});

  const [photos, setPhotos] = useState([]);

  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString();
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    const rows = await fetchClientsForCoach(coachId);
    const clientIds = rows.map((c) => c.id);
    const { start: todayStart } = dayBounds(todayStr());

    const [todaySets, todayMoods] = await Promise.all([
      fetchRecentLoggedSetsForClients(clientIds, todayStart),
      fetchMoodCheckinsForClients(clientIds, todayStart),
    ]);

    const enriched = rows.map((c) => {
      const setsToday = todaySets[c.id] || [];
      const moodsToday = todayMoods[c.id] || [];
      let todayStatus = "Not started";
      if (moodsToday.length > 0) todayStatus = "Completed";
      else if (setsToday.length > 0) todayStatus = "In progress";
      const lastActiveAt = [...setsToday, ...moodsToday].map((r) => r.logged_at).sort().pop() || c.created_at;
      return { ...c, todayStatus, lastActiveAt };
    });
    setClients(enriched);
    setClientsLoading(false);
    if (!selectedId && enriched.length > 0) setSelectedId(enriched[0].id);

    const latest = await fetchLatestMessagePerClient(clientIds);
    setLatestByClient(latest);
  }, [coachId, selectedId]);

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  const loadClientDetail = useCallback(async (clientId) => {
    setProgramLoading(true);
    setActivityLoading(true);
    const [prog, loggedSets, moods, thread, photoList] = await Promise.all([
      fetchProgramWithExercises(clientId),
      fetchRecentLoggedSets(clientId, sinceDate),
      fetchMoodCheckins(clientId, sinceDate),
      fetchThread(clientId),
      fetchProgressPhotos(clientId),
    ]);
    setProgram(prog);
    setProgramLoading(false);

    const byDate = new Map();
    loggedSets.forEach((s) => {
      const date = dateStrOf(s.logged_at);
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });
    const moodByDate = new Map();
    moods.forEach((m) => moodByDate.set(dateStrOf(m.logged_at), m));
    const summaries = Array.from(byDate.entries())
      .map(([date, setCount]) => ({ date, setCount, mood: moodByDate.get(date) || null }))
      .sort((a, b) => b.date.localeCompare(a.date));
    setDailySummaries(summaries);
    setActivityLoading(false);

    setMessages(thread);
    setPhotos(photoList);
  }, [sinceDate]);

  useEffect(() => {
    if (selectedId) loadClientDetail(selectedId);
  }, [selectedId, loadClientDetail]);

  useEffect(() => {
    if (!selectedId) return;
    return subscribeToThread(selectedId, (m) => setMessages((prev) => [...prev, m]));
  }, [selectedId]);

  const unreadTotal = clients.filter((c) => latestByClient[c.id]?.sender === "client").length;

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
    const sortOrder = program.exercises.length;
    const created = await addExercise(program.id, sortOrder);
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
    const msg = await sendMessage({ clientId: selectedId, sender: "coach", text });
    setMessages((prev) => [...prev, msg]);
    setLatestByClient((prev) => ({ ...prev, [selectedId]: msg }));
  }

  function toggleJoined(clientId) {
    setJoinedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
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
                dailySummaries={dailySummaries}
                activityLoading={activityLoading}
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
              />
            )}
          </>
        )
      )}

      {view === "messages" && (
        <MessagesInbox clients={clients} latestByClient={latestByClient} onOpenClient={(id) => { setSelectedId(id); setView("clients"); }} />
      )}

      {view === "challenge" && (
        <ChallengeTracker clients={clients} joinedIds={joinedIds} onToggleJoined={toggleJoined} />
      )}
    </div>
  );
}
