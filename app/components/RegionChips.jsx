import { BODY_REGIONS } from "../lib/format";

// Upper / lower / full-body filter shown under the "Strength" category chip.
export default function RegionChips({ region, onChange, exercises }) {
  const strength = exercises.filter((e) => e.category === "strength");
  const untagged = strength.filter((e) => !e.body_region).length;
  const options = [{ id: "all", label: "All strength" }, ...BODY_REGIONS, ...(untagged ? [{ id: "none", label: `Not sorted (${untagged})` }] : [])];
  return (
    <div className="chips chips-sub">
      {options.map((r) => (
        <button key={r.id} className={`chip${region === r.id ? " active" : ""}`} onClick={() => onChange(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

// Does exercise `e` match the category + region filters?
export function matchesFilter(e, cat, region) {
  if (cat !== "all" && e.category !== cat) return false;
  if (cat !== "strength" || region === "all") return true;
  return region === "none" ? !e.body_region : e.body_region === region;
}
