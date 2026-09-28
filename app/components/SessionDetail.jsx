import { getSessionDetail } from "../lib/api";
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

export default function SessionDetailModal({ sessionId, onClose }) {
  const { data, loading, error } = useAsync(() => getSessionDetail(sessionId), [sessionId]);

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
                            {sets.map((s) => (
                              <span key={s.id} className="pill">
                                {s.set_number}. {setText(s)}
                              </span>
                            ))}
                          </div>
                        )}
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
