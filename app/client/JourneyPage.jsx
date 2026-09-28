import { useAuth } from "../auth/AuthProvider";
import JourneyView from "../components/JourneyView";

export default function JourneyPage() {
  const { profile } = useAuth();
  return (
    <div className="client-page">
      <div className="eyebrow">The Nordic Challenge</div>
      <div className="h1 mt-4 mb-16">Cross Sweden</div>
      <JourneyView clientId={profile.id} editable />
    </div>
  );
}
