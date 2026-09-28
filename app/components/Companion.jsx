import { useState } from "react";
import logo from "../assets/logo.png";
import { COACH_FIRST_NAME, COMPANION_PHOTOS } from "../config";

// The coach's face with a speech bubble. Shows the photo for the given mood
// if there is one, otherwise the coach's profile picture, otherwise the logo.
export function CompanionFace({ mood, coachAvatar, size }) {
  const [failed, setFailed] = useState(false);
  const src = !failed && (COMPANION_PHOTOS[mood] || coachAvatar);
  return (
    <div className="companion-face" style={size ? { width: size, height: size } : undefined}>
      {src ? <img src={src} alt={COACH_FIRST_NAME} onError={() => setFailed(true)} /> : <img className="logo" src={logo} alt="" />}
    </div>
  );
}

export default function Companion({ mood, coachAvatar, children, large = false }) {
  return (
    <div className={`companion${large ? " companion-lg" : ""}`}>
      <CompanionFace mood={mood} coachAvatar={coachAvatar} />
      <div className="companion-bubble grow">
        <div className="companion-name">{COACH_FIRST_NAME}</div>
        {children}
      </div>
    </div>
  );
}
