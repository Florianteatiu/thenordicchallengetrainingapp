// The Cross Sweden journey: every run, ride and swim moves the athlete along
// one of the three legs of Florian's own crossing.
//
// Each leg is a list of places with their distance from the start (km). The
// line on the map is drawn through `at` (where the path runs, e.g. just
// offshore for the swim) and the label sits at `lonlat`.
//
// `story` is where Florian's story for that place goes: a short text that
// pops up when an athlete reaches it. null = no story yet.

import { project } from "./swedenMap";

export const LEGS = [
  {
    kind: "swim",
    label: "Swim",
    verb: "Swimming",
    from: "Gothenburg",
    to: "Malmö",
    totalKm: 240,
    color: "#5ED1E6",
    // Along the west coast; the three unnamed points take the line around
    // the Bjäre peninsula between Halmstad and Ängelholm.
    places: [
      { name: "Gothenburg", km: 0, lonlat: [11.97, 57.71], at: [11.78, 57.65], story: null },
      { name: "Särö", km: 14, lonlat: [11.93, 57.52], at: [11.88, 57.51], story: null },
      { name: "Kungsbacka", km: 21, lonlat: [12.08, 57.49], at: [11.95, 57.45], story: null },
      { name: "Åsa", km: 32, lonlat: [12.12, 57.35], at: [12.07, 57.35], story: null },
      { name: "Bua", km: 43, lonlat: [12.12, 57.24], at: [12.06, 57.23], story: null },
      { name: "Varberg", km: 57, lonlat: [12.25, 57.11], at: [12.18, 57.1], story: null },
      { name: "Glommen", km: 74, lonlat: [12.36, 56.93], at: [12.31, 56.93], story: null },
      { name: "Falkenberg", km: 82, lonlat: [12.49, 56.9], at: [12.43, 56.88], story: null },
      { name: "Haverdal", km: 99, lonlat: [12.67, 56.73], at: [12.62, 56.72], story: null },
      { name: "Halmstad", km: 112, lonlat: [12.86, 56.67], at: [12.78, 56.62], story: null },
      { via: true, km: 123, at: [12.76, 56.5] },
      { via: true, km: 134, at: [12.6, 56.43] },
      { via: true, km: 146, at: [12.7, 56.31] },
      { name: "Ängelholm", km: 153, lonlat: [12.86, 56.24], at: [12.79, 56.26], story: null },
      { name: "Mölle", km: 170, lonlat: [12.5, 56.28], at: [12.47, 56.29], story: null },
      { name: "Höganäs", km: 178, lonlat: [12.55, 56.2], at: [12.51, 56.2], story: null },
      { name: "Helsingborg", km: 195, lonlat: [12.69, 56.05], at: [12.64, 56.04], story: null },
      { name: "Landskrona", km: 213, lonlat: [12.83, 55.87], at: [12.77, 55.86], story: null },
      { name: "Lomma", km: 233, lonlat: [13.07, 55.67], at: [12.98, 55.68], story: null },
      { name: "Malmö", km: 240, lonlat: [13.0, 55.6], at: [12.93, 55.61], story: null },
    ],
  },
  {
    kind: "bike",
    label: "Bike",
    verb: "Cycling",
    from: "Malmö",
    to: "Stockholm",
    totalKm: 695,
    color: "#6AA8FF",
    places: [
      { name: "Malmö", km: 0, lonlat: [13.0, 55.6], story: null },
      { name: "Lund", km: 18, lonlat: [13.19, 55.7], story: null },
      { name: "Hörby", km: 54, lonlat: [13.66, 55.85], story: null },
      { name: "Kristianstad", km: 95, lonlat: [14.16, 56.03], story: null },
      { name: "Karlshamn", km: 145, lonlat: [14.86, 56.17], story: null },
      { name: "Ronneby", km: 173, lonlat: [15.28, 56.21], story: null },
      { name: "Karlskrona", km: 195, lonlat: [15.59, 56.16], story: null },
      { name: "Kalmar", km: 274, lonlat: [16.36, 56.66], story: null },
      { name: "Oskarshamn", km: 347, lonlat: [16.45, 57.26], story: null },
      { name: "Vimmerby", km: 409, lonlat: [15.86, 57.67], story: null },
      { name: "Linköping", km: 500, lonlat: [15.62, 58.41], story: null },
      { name: "Norrköping", km: 542, lonlat: [16.19, 58.59], story: null },
      { name: "Nyköping", km: 597, lonlat: [17.01, 58.75], story: null },
      { name: "Södertälje", km: 664, lonlat: [17.63, 59.2], story: null },
      { name: "Stockholm", km: 695, lonlat: [18.07, 59.33], story: null },
    ],
  },
  {
    kind: "run",
    label: "Run",
    verb: "Running",
    from: "Stockholm",
    to: "Gothenburg",
    totalKm: 513,
    color: "#FFE234",
    // The run shares Södertälje–Linköping with the bike leg, so its line is
    // drawn a touch to the side (`at`) to keep both visible.
    places: [
      { name: "Stockholm", km: 0, lonlat: [18.07, 59.33], story: null },
      { name: "Södertälje", km: 35, lonlat: [17.63, 59.2], at: [17.6, 59.23], story: null },
      { name: "Nyköping", km: 109, lonlat: [17.01, 58.75], at: [16.98, 58.79], story: null },
      { name: "Norrköping", km: 170, lonlat: [16.19, 58.59], at: [16.17, 58.63], story: null },
      { name: "Linköping", km: 217, lonlat: [15.62, 58.41], at: [15.6, 58.45], story: null },
      { name: "Mjölby", km: 253, lonlat: [15.13, 58.33], story: null },
      { name: "Gränna", km: 315, lonlat: [14.47, 58.03], story: null },
      { name: "Jönköping", km: 355, lonlat: [14.16, 57.78], story: null },
      { name: "Ulricehamn", km: 408, lonlat: [13.41, 57.79], story: null },
      { name: "Borås", km: 443, lonlat: [12.94, 57.72], story: null },
      { name: "Gothenburg", km: 513, lonlat: [11.97, 57.71], story: null },
    ],
  },
];

// Named places only (skips the unnamed points that just shape the line).
export const stops = (leg) => leg.places.filter((p) => !p.via);

export const LEG = Object.fromEntries(LEGS.map((l) => [l.kind, l]));

export const pathPoint = (p) => project(...(p.at ?? p.lonlat));

// Map point for `km` along a leg (clamped to the finish).
export function positionAt(leg, km) {
  const places = leg.places;
  const d = Math.max(0, Math.min(km, leg.totalKm));
  for (let i = 1; i < places.length; i++) {
    const a = places[i - 1];
    const b = places[i];
    if (d <= b.km) {
      const t = b.km === a.km ? 1 : (d - a.km) / (b.km - a.km);
      const [ax, ay] = pathPoint(a);
      const [bx, by] = pathPoint(b);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
  }
  return pathPoint(places[places.length - 1]);
}

// SVG points string for the leg from `fromKm` to `toKm`.
export function polyline(leg, fromKm = 0, toKm = leg.totalKm) {
  const pts = [positionAt(leg, fromKm)];
  for (const p of leg.places) if (p.km > fromKm && p.km < toKm) pts.push(pathPoint(p));
  pts.push(positionAt(leg, toKm));
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

// Where an athlete is on a leg: last place passed, next place, progress.
export function legProgress(leg, km) {
  const done = Math.min(km, leg.totalKm);
  const passed = stops(leg).filter((p) => p.km <= done);
  const next = stops(leg).find((p) => p.km > done) ?? null;
  return {
    km,
    fraction: done / leg.totalKm,
    finished: km >= leg.totalKm,
    last: passed[passed.length - 1],
    next,
    toNext: next ? next.km - done : 0,
    reached: passed,
  };
}

// Places newly passed when a leg's total goes from `before` to `after` km.
export function newlyReached(leg, before, after) {
  return stops(leg).filter((p) => p.km > 0 && p.km > before && p.km <= after);
}
