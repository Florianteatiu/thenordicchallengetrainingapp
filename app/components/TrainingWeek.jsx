// When a client can train: how many days a week, which days (1 = Mon … 7 = Sun)
// and how long each session can be.
// Used in the welcome flow, on the client's Me page and on the coach's client page.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LENGTHS = [
  [30, "30 min"],
  [45, "45 min"],
  [60, "1 hour"],
  [75, "1h 15"],
];

export default function TrainingWeek({ perWeek, days, minutes, onChange, coach = false }) {
  const picked = days ?? [];
  const toggleDay = (d) => onChange({ perWeek, minutes, days: picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d].sort() });
  return (
    <div className="col gap-16">
      <div className="field">
        <span>{coach ? "Days a week they can train" : "How many days a week can you train?"}</span>
        <div className="chips chips-days">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={`chip${perWeek === n ? " active" : ""}`} onClick={() => onChange({ perWeek: n, minutes, days: picked })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{coach ? "Days that suit them" : "Which days suit you?"}</span>
        <div className="chips chips-days">
          {WEEKDAYS.map((label, i) => (
            <button key={label} type="button" className={`chip${picked.includes(i + 1) ? " active" : ""}`} onClick={() => toggleDay(i + 1)}>
              {label}
            </button>
          ))}
        </div>
        {perWeek > 0 && picked.length > 0 && picked.length < perWeek && (
          <div className="small faint mt-4">
            Pick at least {perWeek} days, or fewer days a week.
          </div>
        )}
      </div>
      <div className="field">
        <span>{coach ? "Time per session" : "How long can you train each time?"}</span>
        <div className="chips chips-days">
          {LENGTHS.map(([m, label]) => (
            <button key={m} type="button" className={`chip${minutes === m ? " active" : ""}`} onClick={() => onChange({ perWeek, days: picked, minutes: m })}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
