import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { saveExercise } from "../lib/api";
import { CATEGORIES, EQUIPMENT, TRACKING, categoryLabel, exerciseMeta, regionLabel } from "../lib/format";
import RegionChips, { matchesFilter } from "./RegionChips";
import { ErrorBox, Modal } from "./ui";

const DEFAULT_TRACKING = { strength: "weight_reps", conditioning: "reps", endurance: "distance_time", mobility: "reps", core: "reps" };

// Pick one exercise from the library, or create a new one on the spot.
export default function ExercisePicker({ exercises, onPick, onCreated, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [region, setRegion] = useState("all");
  const [creating, setCreating] = useState(false);
  const [newCat, setNewCat] = useState("strength");
  const [newTracking, setNewTracking] = useState("weight_reps");
  const [newEquipment, setNewEquipment] = useState("");
  const [newUnilateral, setNewUnilateral] = useState(false);
  const [error, setError] = useState(null);

  const filtered = useMemo(
    () => exercises.filter((e) => matchesFilter(e, cat, region) && e.name.toLowerCase().includes(q.trim().toLowerCase())),
    [exercises, q, cat, region],
  );
  const exact = exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  async function create() {
    setError(null);
    try {
      const ex = await saveExercise({ name: q.trim(), category: newCat, tracking: newTracking, equipment: newEquipment || null, unilateral: newUnilateral });
      onCreated?.(ex);
      onPick(ex);
    } catch (e) {
      setError(e.code === "23505" ? `“${q.trim()}” with ${newEquipment || "no equipment"} already exists. Pick it from the list, or choose other equipment.` : e);
    }
  }

  return (
    <Modal title="Add exercise" onClose={onClose}>
      <div className="row mb-12" style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)" }} />
        <input
          autoFocus
          className="input"
          style={{ paddingLeft: 36 }}
          placeholder="Search or type a new exercise"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCreating(false);
          }}
        />
      </div>
      <div className="chips mb-12">
        <button className={`chip${cat === "all" ? " active" : ""}`} onClick={() => setCat("all")}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip${cat === c.id ? " active" : ""}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {cat === "strength" && (
        <div className="mb-12" style={{ marginTop: -4 }}>
          <RegionChips region={region} onChange={setRegion} exercises={exercises} />
        </div>
      )}

      {q.trim() && (
        <div className="card card-tight mb-12">
          {!creating ? (
            <button className="link-btn row gap-6" onClick={() => setCreating(true)}>
              <Plus size={16} /> {exact ? `Create “${q.trim()}” with other equipment` : `Create “${q.trim()}”`}
            </button>
          ) : (
            <div className="col">
              <div style={{ fontWeight: 700 }}>New: {q.trim()}</div>
              <div className="grid-2">
                <label className="field">
                  <span>Category</span>
                  <select
                    className="select input-sm"
                    value={newCat}
                    onChange={(e) => {
                      setNewCat(e.target.value);
                      setNewTracking(DEFAULT_TRACKING[e.target.value]);
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Client logs</span>
                  <select className="select input-sm" value={newTracking} onChange={(e) => setNewTracking(e.target.value)}>
                    {TRACKING.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span>Equipment</span>
                  <select className="select input-sm" value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)}>
                    <option value="">None / not set</option>
                    {EQUIPMENT.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span>Sides</span>
                  <div className="chips">
                    <button type="button" className={`chip${!newUnilateral ? " active" : ""}`} onClick={() => setNewUnilateral(false)}>
                      Both together
                    </button>
                    <button type="button" className={`chip${newUnilateral ? " active" : ""}`} onClick={() => setNewUnilateral(true)}>
                      Each side
                    </button>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={create}>
                Create and add
              </button>
            </div>
          )}
        </div>
      )}
      <ErrorBox error={error} />

      <div className="list">
        {filtered.map((e) => (
          <button key={e.id} className="card card-tight card-link row between" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => onPick(e)}>
            <span>
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              {exerciseMeta(e) && <span className="tiny muted"> · {exerciseMeta(e)}</span>}
            </span>
            <span className="pill">{e.body_region ? regionLabel(e.body_region) : categoryLabel(e.category)}</span>
          </button>
        ))}
        {filtered.length === 0 && !q && <div className="small faint center">No exercises in this category yet.</div>}
      </div>
    </Modal>
  );
}
