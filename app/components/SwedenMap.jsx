import { MAP, NEIGHBOURS_PATH, SWEDEN_PATH, project } from "../lib/swedenMap";
import { LEGS, legProgress, polyline, positionAt } from "../lib/journey";

// Crop of the map that holds all three legs.
const VIEW = { x: 0, y: 55, w: MAP.width, h: MAP.height - 55 };
const CITIES = ["Stockholm", "Gothenburg", "Malmö"];

const ICON = { run: "R", bike: "B", swim: "S" };

// Southern Sweden with the three legs of the crossing and where the athlete
// is on each. `totals` = { run, bike, swim } in km. `focus` dims the other legs.
export default function SwedenMap({ totals, focus = null }) {
  const bigCities = CITIES.map((name) => {
    const place = LEGS.flatMap((l) => l.places).find((p) => p.name === name);
    return { name, xy: project(...place.lonlat) };
  });

  return (
    <svg className="sweden-map" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="img" aria-label="Map of the Cross Sweden journey">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sea" cx="40%" cy="60%" r="80%">
          <stop offset="0%" stopColor="#0c1116" />
          <stop offset="100%" stopColor="#050607" />
        </radialGradient>
      </defs>

      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#sea)" />
      <path d={NEIGHBOURS_PATH} fill="#0f1011" stroke="#1d1f21" strokeWidth="0.8" />
      <path d={SWEDEN_PATH} fill="#1b1c1d" stroke="#3a3b3c" strokeWidth="0.9" strokeLinejoin="round" />

      {LEGS.map((leg) => {
        const km = totals?.[leg.kind] ?? 0;
        const prog = legProgress(leg, km);
        const dim = focus && focus !== leg.kind;
        const [px, py] = positionAt(leg, km);
        return (
          <g key={leg.kind} opacity={dim ? 0.28 : 1}>
            <polyline points={polyline(leg)} fill="none" stroke={leg.color} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" strokeLinejoin="round" />
            {km > 0 && (
              <polyline
                points={polyline(leg, 0, km)}
                fill="none"
                stroke={leg.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />
            )}
            {leg.places.slice(1, -1).map((p) => {
              const [x, y] = project(...(p.at ?? p.lonlat));
              const reached = km >= p.km;
              return <circle key={p.name} cx={x} cy={y} r={reached ? 3.2 : 2.6} fill={reached ? leg.color : "#0a0a0a"} stroke={leg.color} strokeWidth="1.3" />;
            })}
            {!dim && (
              <g>
                <circle cx={px} cy={py} r="13" fill={leg.color} opacity="0.25" className="map-pulse" style={{ transformOrigin: `${px}px ${py}px` }} />
                <circle cx={px} cy={py} r="9" fill={leg.color} stroke="#000" strokeWidth="2" />
                <text x={px} y={py + 3.6} textAnchor="middle" fontSize="10" fontWeight="800" fill="#000" fontFamily="Inter, sans-serif">
                  {prog.finished ? "✓" : ICON[leg.kind]}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {bigCities.map(({ name, xy: [x, y] }) => (
        <g key={name}>
          <circle cx={x} cy={y} r="4.5" fill="#fff" stroke="#000" strokeWidth="1.5" />
          <text
            x={name === "Stockholm" ? x - 8 : x + 9}
            y={name === "Malmö" ? y + 16 : y - 8}
            textAnchor={name === "Stockholm" ? "end" : "start"}
            fontSize="14"
            fontWeight="800"
            fill="#fff"
            fontFamily="'Barlow Condensed', Inter, sans-serif"
            letterSpacing="0.06em"
            style={{ textTransform: "uppercase", paintOrder: "stroke" }}
            stroke="#000"
            strokeWidth="3"
          >
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}
