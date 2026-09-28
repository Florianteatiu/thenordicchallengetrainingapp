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
    kind: "run",
    label: "Run",
    verb: "Running",
    from: "Stockholm",
    to: "Gothenburg",
    totalKm: 513,
    color: "#FFE234",
    places: [
      { name: "Stockholm", km: 0, lonlat: [18.07, 59.33], story: null },
      { name: "Södertälje", km: 37, lonlat: [17.63, 59.2], story: null },
      { name: "Strängnäs", km: 73, lonlat: [17.03, 59.38], story: null },
      { name: "Eskilstuna", km: 120, lonlat: [16.51, 59.37], story: null },
      { name: "Arboga", km: 168, lonlat: [15.84, 59.39], story: null },
      { name: "Örebro", km: 209, lonlat: [15.21, 59.27], story: null },
      { name: "Hova", km: 298, lonlat: [14.21, 58.86], story: null },
      { name: "Mariestad", km: 330, lonlat: [13.82, 58.71], story: null },
      { name: "Skara", km: 377, lonlat: [13.44, 58.39], story: null },
      { name: "Vårgårda", km: 440, lonlat: [12.81, 58.03], story: null },
      { name: "Alingsås", km: 466, lonlat: [12.53, 57.93], story: null },
      { name: "Gothenburg", km: 513, lonlat: [11.97, 57.71], story: null },
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
      { name: "Lund", km: 20, lonlat: [13.19, 55.7], story: null },
      { name: "Höör", km: 55, lonlat: [13.54, 55.94], story: null },
      { name: "Hässleholm", km: 90, lonlat: [13.77, 56.16], story: null },
      { name: "Älmhult", km: 145, lonlat: [14.14, 56.55], story: null },
      { name: "Växjö", km: 215, lonlat: [14.81, 56.88], story: null },
      { name: "Värnamo", km: 285, lonlat: [14.05, 57.19], story: null },
      { name: "Jönköping", km: 360, lonlat: [14.16, 57.78], story: null },
      { name: "Gränna", km: 400, lonlat: [14.46, 58.03], story: null },
      { name: "Linköping", km: 495, lonlat: [15.62, 58.41], story: null },
      { name: "Norrköping", km: 540, lonlat: [16.19, 58.59], story: null },
      { name: "Nyköping", km: 600, lonlat: [17.01, 58.75], story: null },
      { name: "Södertälje", km: 660, lonlat: [17.63, 59.2], story: null },
      { name: "Stockholm", km: 695, lonlat: [18.07, 59.33], story: null },
    ],
  },
  {
    kind: "swim",
    label: "Swim",
    verb: "Swimming",
    from: "Gothenburg",
    to: "Malmö",
    totalKm: 240,
    color: "#5ED1E6",
    places: [
      { name: "Gothenburg", km: 0, lonlat: [11.97, 57.71], at: [11.8, 57.64], story: null },
      { name: "Kungsbacka", km: 30, lonlat: [12.07, 57.49], at: [11.93, 57.44], story: null },
      { name: "Varberg", km: 75, lonlat: [12.25, 57.11], at: [12.15, 57.1], story: null },
      { name: "Falkenberg", km: 105, lonlat: [12.49, 56.9], at: [12.38, 56.89], story: null },
      { name: "Halmstad", km: 140, lonlat: [12.86, 56.67], at: [12.72, 56.63], story: null },
      { name: "Båstad", km: 170, lonlat: [12.85, 56.43], at: [12.75, 56.47], story: null },
      { name: "Kullaberg", km: 190, lonlat: [12.47, 56.3], at: [12.4, 56.29], story: null },
      { name: "Helsingborg", km: 210, lonlat: [12.69, 56.05], at: [12.63, 56.04], story: null },
      { name: "Landskrona", km: 225, lonlat: [12.83, 55.87], at: [12.77, 55.86], story: null },
      { name: "Malmö", km: 240, lonlat: [13.0, 55.6], at: [12.93, 55.61], story: null },
    ],
  },
];

export const LEG = Object.fromEntries(LEGS.map((l) => [l.kind, l]));

const pathPoint = (p) => project(...(p.at ?? p.lonlat));

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
  const passed = leg.places.filter((p) => p.km <= done);
  const next = leg.places.find((p) => p.km > done) ?? null;
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
  return leg.places.filter((p) => p.km > 0 && p.km > before && p.km <= after);
}
