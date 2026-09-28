import { useState } from "react";
import { Bike, CalendarDays, ExternalLink, Footprints, MapPin, Star, Waves } from "lucide-react";
import { formatDate, todayISO } from "../lib/dates";
import { LEG } from "../lib/journey";
import { WEBSITE_URL } from "../config";

export const EVENT_KINDS = [
  { id: "swim", label: "Swim leg", icon: Waves },
  { id: "bike", label: "Bike leg", icon: Bike },
  { id: "run", label: "Run leg", icon: Footprints },
  { id: "event", label: "Event", icon: Star },
];
const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.id, k]));
export const kindColor = (kind) => LEG[kind]?.color ?? "#FFFFFF";

export function eventStatus(e, today = todayISO()) {
  const end = e.ends_on ?? e.starts_on;
  if (end < today) return "past";
  if (e.starts_on <= today) return "now";
  return "upcoming";
}

export function dateRange(e) {
  const short = { day: "numeric", month: "short" };
  if (!e.ends_on || e.ends_on === e.starts_on) return formatDate(e.starts_on, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${formatDate(e.starts_on, short)} – ${formatDate(e.ends_on, { ...short, year: "numeric" })}`;
}

function daysUntil(iso) {
  return Math.round((new Date(iso + "T12:00") - new Date(todayISO() + "T12:00")) / 86400000);
}

export function EventRow({ event, onClick }) {
  const k = KIND[event.kind] ?? KIND.event;
  const Icon = k.icon;
  const status = eventStatus(event);
  const inDays = daysUntil(event.starts_on);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`card card-tight event-row${onClick ? " card-link" : ""}`} onClick={onClick} style={status === "past" ? { opacity: 0.55 } : undefined}>
      <div className="leg-icon small" style={{ background: kindColor(event.kind) }}>
        <Icon size={16} />
      </div>
      <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
        <div className="row between gap-6">
          <span style={{ fontWeight: 700 }}>{event.title}</span>
          {status === "now" && <span className="pill pill-green nowrap">Happening now</span>}
          {status === "upcoming" && inDays <= 30 && <span className="pill pill-yellow nowrap">{inDays === 1 ? "Tomorrow" : `In ${inDays} days`}</span>}
        </div>
        <div className="tiny muted row gap-6 wrap mt-4">
          <span className="row gap-4">
            <CalendarDays size={12} /> {dateRange(event)}
          </span>
          {event.location && (
            <span className="row gap-4">
              <MapPin size={12} /> {event.location}
            </span>
          )}
        </div>
        {event.description && <div className="small muted mt-4 pre">{event.description}</div>}
        {event.url && !onClick && (
          <a className="small yellow row gap-4 mt-4" href={event.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
            More info <ExternalLink size={13} />
          </a>
        )}
      </div>
    </Tag>
  );
}

// Florian's challenges and events for clients: upcoming first, past ones
// tucked away, and a link to the website.
export default function ChallengeCalendar({ events }) {
  const [showPast, setShowPast] = useState(false);
  const current = events.filter((e) => eventStatus(e) !== "past");
  const past = events.filter((e) => eventStatus(e) === "past").reverse();

  return (
    <div className="col gap-8">
      {current.length === 0 && past.length === 0 && <div className="empty small">Dates for Florian's next challenges are coming soon.</div>}
      {current.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      {past.length > 0 && (
        <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => setShowPast(!showPast)}>
          {showPast ? "Hide past events" : `Show past events (${past.length})`}
        </button>
      )}
      {showPast && past.map((e) => <EventRow key={e.id} event={e} />)}
      <a className="btn btn-ghost btn-block" href={WEBSITE_URL} target="_blank" rel="noreferrer">
        Follow the challenge on {WEBSITE_URL.replace(/^https?:\/\//, "")} <ExternalLink size={15} />
      </a>
    </div>
  );
}
