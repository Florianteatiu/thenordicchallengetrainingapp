import { useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { COACH_FIRST_NAME } from "../config";
import { CompanionFace } from "../components/Companion";
import Chat from "../components/Chat";

export default function ChatPage() {
  const { profile } = useAuth();
  const { coach } = useOutletContext();
  return (
    <div className="chat-screen">
      <div className="chat-header">
        <CompanionFace mood="wave" coachAvatar={coach?.avatar_url} size={42} />
        <div>
          <div className="h3">{coach?.full_name || COACH_FIRST_NAME}</div>
          <div className="tiny faint">Your coach · replies personally</div>
        </div>
      </div>
      <Chat
        clientId={profile.id}
        me={profile}
        other={coach}
        className="chat-full"
        emptyText={`Say hi to ${COACH_FIRST_NAME}! Ask anything about your training, send a voice note, or tell him how you feel.`}
      />
    </div>
  );
}
