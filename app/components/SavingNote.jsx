import { CloudOff } from "lucide-react";
import { usePendingSaves } from "../lib/saveQueue";

// Shown while logged sets are waiting for the network. They're kept on the
// phone and sent as soon as the connection is back.
export default function SavingNote() {
  const pending = usePendingSaves();
  if (!pending) return null;
  return (
    <div className="saving-note small row gap-6">
      <CloudOff size={15} /> Saving {pending} change{pending === 1 ? "" : "s"}… kept on this phone until the connection is back.
    </div>
  );
}
