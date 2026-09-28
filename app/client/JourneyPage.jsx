import { useAuth } from "../auth/AuthProvider";
import { listEvents } from "../lib/api";
import JourneyView from "../components/JourneyView";
import ChallengeCalendar from "../components/ChallengeCalendar";
import { useAsync } from "../components/ui";

export default function JourneyPage() {
  const { profile } = useAuth();
  const events = useAsync(listEvents, []);
  return (
    <div className="client-page">
      <div className="eyebrow">The Nordic Challenge</div>
      <div className="h1 mt-4 mb-16">Cross Sweden</div>
      <JourneyView clientId={profile.id} editable />
      <div className="section">
        <div className="eyebrow mb-8">Florian's challenge calendar</div>
        {events.data && <ChallengeCalendar events={events.data} />}
      </div>
    </div>
  );
}
