import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Send, Square, Trash2, X } from "lucide-react";
import { deleteMessage, listMessages, markMessagesRead, sendMessage, signedUrl, subscribeToMessages, uploadVoiceNote } from "../lib/api";
import { formatDate, todayISO, toISODate } from "../lib/dates";
import { formatClock } from "../lib/format";
import { Avatar, ErrorBox, Spinner } from "./ui";

const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso) {
  const today = todayISO();
  const yesterday = toISODate(new Date(Date.now() - 86400000));
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long" });
}

export function VoicePlayer({ path, duration, mine }) {
  const audio = useRef(null);
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  async function toggle() {
    try {
      let src = url;
      if (!src) {
        src = await signedUrl("voice-notes", path);
        setUrl(src);
        audio.current.src = src;
      }
      if (playing) audio.current.pause();
      else await audio.current.play();
    } catch {
      setError(true);
    }
  }

  return (
    <div className={`voice${mine ? " mine" : ""}`}>
      <button className="voice-btn" onClick={toggle} aria-label={playing ? "Pause voice note" : "Play voice note"}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="voice-track">
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="tiny">{error ? "Can't play" : formatClock(duration || 0)}</span>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : duration || 1;
          setProgress(Math.min(1, a.currentTime / total));
        }}
        onError={() => url && setError(true)}
      />
    </div>
  );
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

function useRecorder(onDone) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef(null);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    cancelled.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer.current);
      setRecording(false);
      const secs = Math.round((Date.now() - started.current) / 1000);
      if (!cancelled.current && secs >= 1) onDone(new Blob(chunks.current, { type: r.mimeType || mimeType || "audio/webm" }), secs);
    };
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= 300) r.state === "recording" && r.stop(); // 5 minutes max
    }, 250);
    r.start();
    setRecording(true);
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  function cancel() {
    cancelled.current = true;
    stop();
  }

  useEffect(() => () => {
    cancelled.current = true;
    clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  return { recording, seconds, start, stop, cancel, supported: typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia };
}

// One conversation (a client and the coach). `me` = the signed-in profile,
// `other` = who they're talking to (for the avatar/name).
export default function Chat({ clientId, me, other, emptyText, className = "" }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const scroller = useRef(null);
  const atBottom = useRef(true);

  const recorder = useRecorder(async (blob, secs) => {
    setSending(true);
    setError(null);
    try {
      const path = await uploadVoiceNote(clientId, blob);
      const m = await sendMessage({ clientId, audioPath: path, audioDurationSec: secs });
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      atBottom.current = true;
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  });

  useEffect(() => {
    let alive = true;
    setMessages(null);
    listMessages(clientId)
      .then((list) => {
        if (!alive) return;
        setMessages(list);
        if (list.some((m) => m.sender_id !== me.id && !m.read_at)) markMessagesRead(clientId).catch(() => {});
      })
      .catch((e) => alive && setError(e));

    const unsubscribe = subscribeToMessages(clientId, ({ eventType, new: row, old }) => {
      if (eventType === "INSERT") {
        setMessages((list) => (list && !list.some((m) => m.id === row.id) ? [...list, row] : list));
        if (row.sender_id !== me.id) markMessagesRead(clientId).catch(() => {});
      } else if (eventType === "DELETE") {
        setMessages((list) => list?.filter((m) => m.id !== old.id));
      } else if (eventType === "UPDATE") {
        setMessages((list) => list?.map((m) => (m.id === row.id ? row : m)));
      }
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [clientId, me.id]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const m = await sendMessage({ clientId, body });
      setText("");
      atBottom.current = true;
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  }

  async function remove(m) {
    setSelected(null);
    try {
      await deleteMessage(m.id);
      setMessages((list) => list.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      await recorder.start();
    } catch {
      setError("Couldn't use the microphone. Check that the app is allowed to use it in your phone's settings.");
    }
  }

  let lastDay = null;

  return (
    <div className={`chat ${className}`}>
      <div
        className="chat-messages"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {messages === null && !error && <Spinner />}
        {messages?.length === 0 && <div className="chat-empty">{emptyText}</div>}
        {messages?.map((m) => {
          const mine = m.sender_id === me.id;
          const day = toISODate(new Date(m.created_at));
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <div className="chat-day">{dayLabel(day)}</div>}
              <div className={`msg-row${mine ? " mine" : ""}`}>
                {!mine && <Avatar name={other?.full_name} url={other?.avatar_url} size={28} />}
                <div className="msg-col">
                  <div className={`msg${mine ? " mine" : ""}`} onClick={() => mine && setSelected(selected === m.id ? null : m.id)}>
                    {m.context_label && <div className="msg-context">{m.context_label}</div>}
                    {m.audio_path && <VoicePlayer path={m.audio_path} duration={m.audio_duration_sec} mine={mine} />}
                    {m.body && <div className="msg-body">{m.body}</div>}
                  </div>
                  <div className="msg-meta">
                    {timeOf(m.created_at)}
                    {mine && m.read_at && " · Seen"}
                    {selected === m.id && (
                      <button className="link-btn red" style={{ marginLeft: 8 }} onClick={() => remove(m)}>
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="chat-error">
          <ErrorBox error={error} />
        </div>
      )}

      <div className="composer">
        {recorder.recording ? (
          <>
            <button className="icon-btn" onClick={recorder.cancel} aria-label="Cancel recording">
              <X size={20} />
            </button>
            <div className="grow row gap-6 recording">
              <span className="rec-dot" /> Recording {formatClock(recorder.seconds)}
            </div>
            <button className="send-btn" onClick={recorder.stop} aria-label="Stop and send">
              <Square size={16} fill="currentColor" />
            </button>
          </>
        ) : (
          <>
            <textarea
              className="composer-input"
              rows={1}
              value={text}
              placeholder={sending ? "Sending…" : "Message"}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(120, e.target.scrollHeight) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {text.trim() ? (
              <button className="send-btn" onClick={send} disabled={sending} aria-label="Send">
                <Send size={18} />
              </button>
            ) : (
              recorder.supported && (
                <button className="send-btn" onClick={startRecording} disabled={sending} aria-label="Record a voice note">
                  <Mic size={19} />
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
