import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, MessageCircle, Trophy, Search, Trash2, Plus, ChevronRight, X,
  Image as ImageIcon, Send, Flame, Clock, LogOut, LayoutTemplate,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, ghostBtn, cardStyle, editInputStyle } from "../theme";
import logo from "../assets/logo.png";
import { initialsFor } from "../lib/utils";
import { fetchClientsForCoach } from "../lib/api/clients";
import {
  fetchProgramsForClient, fetchProgramById, createProgram, updateProgramMeta, deleteProgram,
  addExercise, updateExercise, deleteExercise,
  fetchTemplatesForCoach, createTemplate, assignTemplateToClient,
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
    { id: "templates", label: "Templates", icon: LayoutTemplate },
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

// Keeps its own local text so typing a comma or trailing space isn't
// immediately stripped by re-deriving the input's value from the parsed
// array on every keystroke (that was the bug). Only parses + commits on
// blur. `key={exercise.id}` at the call site resets this when the exercise
// being edited changes.
function AlternativesInput({ value, onCommit }) {
  const [text, setText] = useState((value || []).join(", "));
  function commit() {
    onCommit(text.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      style={editInputStyle}
    />
  );
}

// ---------- Program editor ----------
function ProgramEditor({ program, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta }) {
  if (!program) {
    return (
      <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13.5, color: C.textSecondary }}>
        No program selected.
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
          <AlternativesInput key={ex.id} value={ex.alternatives} onCommit={(list) => onEditAlternatives(ex.id, list)} />
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

// ---------- Program picker (a client can have more than one over time) ----------
function ProgramPicker({ clientPrograms, activeProgramId, onSelectProgram, onCreateProgram, creatingProgram, templates, onAssignTemplate, assigningTemplateId, onDeleteProgram }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {clientPrograms.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {clientPrograms.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 2, background: p.id === activeProgramId ? C.ink : C.paperMuted, borderRadius: 20, paddingRight: 4 }}>
              <button onClick={() => onSelectProgram(p.id)} style={{
                fontSize: 12, fontWeight: 700, padding: "6px 4px 6px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: "none",
                color: p.id === activeProgramId ? "#fff" : C.textSecondary,
              }}>
                {p.title || "Untitled"} <span style={{ opacity: 0.7, fontWeight: 600 }}>· {p.exerciseCount}</span>
              </button>
              <button onClick={() => onDeleteProgram(p.id)} aria-label="Delete program" style={{
                width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "none",
                color: p.id === activeProgramId ? "rgba(255,255,255,0.7)" : C.textMuted,
              }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button onClick={onCreateProgram} disabled={creatingProgram} style={ghostBtn}>
          <Plus size={13} /> {creatingProgram ? "Creating..." : "New blank program"}
        </button>
        {templates.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) onAssignTemplate(e.target.value); }}
            disabled={!!assigningTemplateId}
            style={{ ...editInputStyle, width: "auto", padding: "8px 10px" }}
          >
            <option value="" disabled>{assigningTemplateId ? "Assigning..." : "Assign a template..."}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.title || "Untitled"} ({t.exerciseCount} ex.)</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ---------- Client detail ----------
function ClientDetail({ client, program, programLoading, clientPrograms, onSelectProgram, onDeleteProgram, templates, onAssignTemplate, assigningTemplateId, dailySummaries, activityLoading, messages, photos, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta, onCreateProgram, creatingProgram, onSendMessage }) {
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
          <>
            <ProgramPicker
              clientPrograms={clientPrograms}
              activeProgramId={program?.id}
              onSelectProgram={onSelectProgram}
              onCreateProgram={onCreateProgram}
              creatingProgram={creatingProgram}
              templates={templates}
              onAssignTemplate={onAssignTemplate}
              assigningTemplateId={assigningTemplateId}
              onDeleteProgram={onDeleteProgram}
            />
            {programLoading
              ? <div style={{ fontSize: 13, color: C.textSecondary }}>Loading...</div>
              : <ProgramEditor program={program} onEditField={onEditField} onEditAlternatives={onEditAlternatives} onRemove={onRemove} onAdd={onAdd} onEditMeta={onEditMeta} />}
          </>
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

// ---------- Program templates ----------
function TemplatesView({ templates, templatesLoading, templatesError, activeTemplate, editorLoading, onSelectTemplate, onCreateTemplate, creating, onDeleteTemplate, onEditField, onEditAlternatives, onRemove, onAdd, onEditMeta }) {
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "16px 14px 10px" }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.textPrimary, marginBottom: 10 }}>Program templates</div>
          <button onClick={onCreateTemplate} disabled={creating} style={{ ...ghostBtn, width: "100%", justifyContent: "center" }}>
            <Plus size={14} /> {creating ? "Creating..." : "New template"}
          </button>
          {templatesError && (
            <div style={{ fontSize: 11.5, color: "#A6403C", background: "#F3E9E9", borderRadius: 6, padding: "8px 10px", marginTop: 8 }}>
              {templatesError}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {templatesLoading && <div style={{ fontSize: 12.5, color: C.textSecondary, padding: "12px 8px" }}>Loading...</div>}
          {!templatesLoading && templates.length === 0 && <div style={{ fontSize: 12.5, color: C.textSecondary, padding: "12px 8px" }}>No templates yet.</div>}
          {templates.map((t) => (
            <button key={t.id} onClick={() => onSelectTemplate(t.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", textAlign: "left",
              padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2,
              background: activeTemplate?.id === t.id ? C.paperMuted : "transparent",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{t.title || "Untitled"}</div>
              <div style={{ fontSize: 11, color: C.textSecondary }}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? "" : "s"}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {!activeTemplate ? (
          <div style={{ color: C.textSecondary, fontSize: 13.5 }}>Select a template to edit, or create a new one.</div>
        ) : editorLoading ? (
          <div style={{ color: C.textSecondary, fontSize: 13 }}>Loading...</div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button onClick={() => onDeleteTemplate(activeTemplate.id)} style={{ ...ghostBtn, color: "#A6403C", background: "#F3E9E9" }}>
                <Trash2 size={13} /> Delete template
              </button>
            </div>
            <ProgramEditor program={activeTemplate} onEditField={onEditField} onEditAlternatives={onEditAlternatives} onRemove={onRemove} onAdd={onAdd} onEditMeta={onEditMeta} />
          </div>
        )}
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
  const [clientPrograms, setClientPrograms] = useState([]);

  const [dailySummaries, setDailySummaries] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [latestByClient, setLatestByClient] = useState({});

  const [photos, setPhotos] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templateEditorLoading, setTemplateEditorLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [assigningTemplateId, setAssigningTemplateId] = useState(null);

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

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const rows = await fetchTemplatesForCoach(coachId);
      setTemplates(rows);
    } catch (e) {
      console.error("Failed to load templates", e);
      setTemplatesError(e.message || "Failed to load templates.");
    } finally {
      setTemplatesLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const loadClientDetail = useCallback(async (clientId) => {
    setProgramLoading(true);
    setActivityLoading(true);
    const [progs, loggedSets, moods, thread, photoList] = await Promise.all([
      fetchProgramsForClient(clientId),
      fetchRecentLoggedSets(clientId, sinceDate),
      fetchMoodCheckins(clientId, sinceDate),
      fetchThread(clientId),
      fetchProgressPhotos(clientId),
    ]);
    setClientPrograms(progs);
    if (progs.length > 0) {
      setProgram(await fetchProgramById(progs[0].id));
    } else {
      setProgram(null);
    }
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

  function editAlternatives(exId, list) {
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
        coachId,
        clientId: selectedId,
        weekLabel: "Week 1 · Day 1",
        title: "New program",
        durationMin: 45,
      });
      setClientPrograms((prev) => [{ ...created, exerciseCount: 0 }, ...prev]);
      setProgram(created);
    } finally {
      setCreatingProgram(false);
    }
  }

  async function handleAssignTemplate(templateId) {
    setAssigningTemplateId(templateId);
    try {
      const assigned = await assignTemplateToClient(templateId, selectedId);
      setClientPrograms((prev) => [{ ...assigned, exerciseCount: assigned.exercises.length }, ...prev]);
      setProgram(assigned);
    } finally {
      setAssigningTemplateId(null);
    }
  }

  async function selectProgram(id) {
    setProgramLoading(true);
    try {
      setProgram(await fetchProgramById(id));
    } finally {
      setProgramLoading(false);
    }
  }

  async function handleDeleteClientProgram(id) {
    if (!window.confirm("Delete this program? This can't be undone.")) return;
    try {
      await deleteProgram(id);
    } catch (e) {
      window.alert(e.message || "Failed to delete program.");
      return;
    }
    const remaining = clientPrograms.filter((p) => p.id !== id);
    setClientPrograms(remaining);
    if (program?.id === id) {
      if (remaining.length > 0) {
        setProgramLoading(true);
        setProgram(await fetchProgramById(remaining[0].id));
        setProgramLoading(false);
      } else {
        setProgram(null);
      }
    }
  }

  async function selectTemplate(id) {
    setTemplateEditorLoading(true);
    setTemplatesError(null);
    try {
      const full = await fetchProgramById(id);
      setActiveTemplate(full);
    } catch (e) {
      console.error("Failed to load template", e);
      setTemplatesError(e.message || "Failed to load template.");
    } finally {
      setTemplateEditorLoading(false);
    }
  }

  async function handleCreateTemplate() {
    setCreatingTemplate(true);
    setTemplatesError(null);
    try {
      const created = await createTemplate({ coachId, weekLabel: "Week 1 · Day 1", title: "New template", durationMin: 45 });
      setTemplates((prev) => [created, ...prev]);
      setActiveTemplate(created);
    } catch (e) {
      console.error("Failed to create template", e);
      setTemplatesError(e.message || "Failed to create template.");
    } finally {
      setCreatingTemplate(false);
    }
  }

  function patchTemplateExerciseLocal(exId, patch) {
    setActiveTemplate((prev) => ({ ...prev, exercises: prev.exercises.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)) }));
  }

  async function editTemplateField(exId, field, value) {
    patchTemplateExerciseLocal(exId, { [field]: value });
    try {
      await updateExercise(exId, { [field]: value });
    } catch (e) {
      console.error("Failed to save template exercise field", e);
    }
  }

  function editTemplateAlternatives(exId, list) {
    editTemplateField(exId, "alternatives", list);
  }

  async function removeTemplateExercise(exId) {
    setActiveTemplate((prev) => ({ ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exId) }));
    try {
      await deleteExercise(exId);
    } catch (e) {
      console.error("Failed to delete template exercise", e);
    }
  }

  async function addTemplateExercise() {
    const sortOrder = activeTemplate.exercises.length;
    const created = await addExercise(activeTemplate.id, sortOrder);
    setActiveTemplate((prev) => ({ ...prev, exercises: [...prev.exercises, created] }));
  }

  async function editTemplateMeta(field, value) {
    const templateId = activeTemplate.id;
    setActiveTemplate((prev) => ({ ...prev, [field]: value }));
    setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, [field]: value } : t)));
    try {
      await updateProgramMeta(templateId, { [field]: value });
    } catch (e) {
      console.error("Failed to save template field", e);
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm("Delete this template? This can't be undone.")) return;
    await deleteProgram(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (activeTemplate?.id === id) setActiveTemplate(null);
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
                clientPrograms={clientPrograms}
                onSelectProgram={selectProgram}
                onDeleteProgram={handleDeleteClientProgram}
                templates={templates}
                onAssignTemplate={handleAssignTemplate}
                assigningTemplateId={assigningTemplateId}
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

      {view === "templates" && (
        <TemplatesView
          templates={templates}
          templatesLoading={templatesLoading}
          templatesError={templatesError}
          activeTemplate={activeTemplate}
          editorLoading={templateEditorLoading}
          onSelectTemplate={selectTemplate}
          onCreateTemplate={handleCreateTemplate}
          creating={creatingTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onEditField={editTemplateField}
          onEditAlternatives={editTemplateAlternatives}
          onRemove={removeTemplateExercise}
          onAdd={addTemplateExercise}
          onEditMeta={editTemplateMeta}
        />
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
