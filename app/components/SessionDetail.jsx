import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSessionDetail, listSessionComments, sendMessage } from "../lib/api";
import { formatDateTime } from "../lib/dates";
import { blockSummary, formatClock, formatDistance, formatLabel } from "../lib/format";
import { ErrorBox, Modal, Spinner, useAsync } from "./ui";

export const FEELINGS = ["😫", "😕", "😐", "🙂", "🤩"];

function setText(s) {
  const parts = [];
  if (s.load_kg != null) parts.push(`${+s.load_kg} kg`);
  if (s.reps != null) parts.push(`${s.reps} reps`);
  if (s.distance_m != null) parts.push(formatDistance(s.distance_m));
  if (s.duration_sec != null) parts.push(formatClock(s.duration_sec));
  return parts.join(" × ") || "done";
}

// Inline box to comment on a set or the whole workout. The comment goes into
// the client's chat, quoting what it's about.
function CommentBox({ placeholder, onSend, autoFocus }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(text);
      setText("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="col gap-6 mt-8">
      <div className="row gap-6">
        <input
          className="input grow"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={placeholder}
        />
        <button className="send-btn" onClick={send} disabled={busy || !text.trim()} aria-label="Send comment">
          <Send size={17} />
        </button>
      </div>
      <ErrorBox error={error} />
    </div>
  );
}

function Comments({ list, profile }) {
  if (!list.length) return null;
  return (
    <div className="col gap-4 mt-8">
      {list.map((m) => (
        <div key={m.id} className="set-comment">
          <MessageCircle size={13} />
          <span>
            <b>{m.sender_id === profile.id ? "You" : m.sender_id === m.client_id ? "Client" : "Coach"}:</b> {m.body || "🎤 Voice note (in chat)"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SessionDetailModal({ sessionId, onClose }) {
  const { profile } = useAuth();
  const isCoach = profile.role === "coach";
  const [commenting, setCommenting] = useState(null); // set_log id or "workout"
  const { data, loading, error, setData } = useAsync(async () => {
    const [detail, comments] = await Promise.all([getSessionDetail(sessionId), listSessionComments(sessionId)]);
    return { ...detail, comments };
  }, [sessionId]);

  async function comment(body, set, label) {
    const m = await sendMessage({
      clientId: data.session.client_id,
      body,
      sessionId,
      setLogId: set?.id ?? null,
      contextLabel: label,
    });
    setData((d) => ({ ...d, comments: [...d.comments, m] }));
    setCommenting(null);
  }

  return (
    <Modal title={data?.session.workout_title || "Workout"} onClose={onClose}>
      {loading && <Spinner />}
      <ErrorBox error={error} />
      {data && (
        <div className="stack">
          <div className="row wrap small muted">
            <span>{data.session.completed_at ? `Completed ${formatDateTime(data.session.completed_at)}` : "In progress"}</span>
            {data.session.feeling && <span style={{ fontSize: 20 }}>{FEELINGS[data.session.feeling - 1]}</span>}
            {data.session.rpe && <span className="pill pill-yellow">RPE {data.session.rpe}</span>}
          </div>
          {data.session.notes && <div className="card card-tight small">“{data.session.notes}”</div>}
          <Comments list={data.comments.filter((m) => !m.set_log_id)} profile={profile} />
          {isCoach &&
            (commenting === "workout" ? (
              <CommentBox autoFocus placeholder="Comment on the whole workout…" onSend={(t) => comment(t, null, `On your workout: ${data.session.workout_title}`)} />
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setCommenting("workout")}>
                <MessageCircle size={15} /> Comment on this workout
              </button>
            ))}
          {isCoach && <div className="tiny faint">Tap a set to comment on it. Comments land in the client's chat.</div>}

          {(data.workout?.blocks ?? []).map((block, bi) => {
            const blockLog = data.blocks.find((b) => b.block_id === block.id);
            return (
              <div key={block.id} className="block-card">
                <div className="block-head row">
                  <div className="letter">{String.fromCharCode(65 + bi)}</div>
                  <div className="grow">
                    <div className="h3">{block.name || formatLabel(block.format)}</div>
                    {block.format !== "sets" && <div className="tiny muted">{blockSummary(block)}</div>}
                  </div>
                </div>
                {block.format !== "sets" && (
                  <div className="exercise small">
                    {blockLog ? (
                      <span className="green">
                        {[
                          blockLog.rounds != null && `${blockLog.rounds} rounds`,
                          blockLog.extra_reps && `+ ${blockLog.extra_reps} reps`,
                          blockLog.duration_sec && formatClock(blockLog.duration_sec),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Done"}
                      </span>
                    ) : (
                      <span className="faint">Not logged</span>
                    )}
                    {blockLog?.notes && <div className="muted mt-4">“{blockLog.notes}”</div>}
                    <div className="faint mt-4">{block.items.map((i) => i.exercise?.name).join(", ")}</div>
                  </div>
                )}
                {block.format === "sets" &&
                  block.items.map((item) => {
                    const sets = data.sets.filter((s) => s.block_exercise_id === item.id).sort((a, b) => a.set_number - b.set_number);
                    return (
                      <div key={item.id} className="exercise">
                        <div style={{ fontWeight: 700 }}>{item.exercise?.name}</div>
                        {sets.length === 0 ? (
                          <div className="small faint">Not logged</div>
                        ) : (
                          <div className="chips mt-4">
                            {sets.map((s) =>
                              isCoach ? (
                                <button
                                  key={s.id}
                                  className={`pill pill-btn${commenting === s.id ? " pill-yellow" : ""}${data.comments.some((m) => m.set_log_id === s.id) ? " has-comment" : ""}`}
                                  onClick={() => setCommenting(commenting === s.id ? null : s.id)}
                                >
                                  {s.set_number}. {setText(s)}
                                </button>
                              ) : (
                                <span key={s.id} className={`pill${data.comments.some((m) => m.set_log_id === s.id) ? " has-comment" : ""}`}>
                                  {s.set_number}. {setText(s)}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                        {sets.some((s) => s.id === commenting) && (
                          <CommentBox
                            autoFocus
                            placeholder={`Comment on set ${sets.find((s) => s.id === commenting).set_number}…`}
                            onSend={(t) => {
                              const set = sets.find((s) => s.id === commenting);
                              return comment(t, set, `${item.exercise?.name} · set ${set.set_number}: ${setText(set)}`);
                            }}
                          />
                        )}
                        <Comments list={data.comments.filter((m) => sets.some((s) => s.id === m.set_log_id))} profile={profile} />
                      </div>
                    );
                  })}
              </div>
            );
          })}
          {!data.workout && <div className="small faint">This workout has since been removed from the program.</div>}
        </div>
      )}
    </Modal>
  );
}
