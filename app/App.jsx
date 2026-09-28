import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import AuthPage, { SetNewPassword } from "./auth/AuthPage";
import { ErrorBox, PageLoader } from "./components/ui";

import CoachLayout from "./coach/CoachLayout";
import ClientsPage from "./coach/ClientsPage";
import ClientPage from "./coach/ClientPage";
import ProgramsPage from "./coach/ProgramsPage";
import ProgramPage from "./coach/ProgramPage";
import WorkoutsPage from "./coach/WorkoutsPage";
import WorkoutBuilderPage from "./coach/WorkoutBuilderPage";
import LibraryPage from "./coach/LibraryPage";
import CoachProfilePage from "./coach/CoachProfilePage";
import InboxPage from "./coach/InboxPage";
import EventsPage from "./coach/EventsPage";

import ClientLayout from "./client/ClientLayout";
import TodayPage from "./client/TodayPage";
import PlanPage from "./client/PlanPage";
import HistoryPage from "./client/HistoryPage";
import MePage from "./client/MePage";
import WorkoutPlayer from "./client/WorkoutPlayer";
import JourneyPage from "./client/JourneyPage";
import ChatPage from "./client/ChatPage";
import CheckinPage from "./client/CheckinPage";
import WelcomeFlow from "./client/WelcomeFlow";

export default function App() {
  const { session, profile, loading, profileError, recovering, signOut } = useAuth();

  if (loading) return <PageLoader />;
  if (recovering) return <SetNewPassword />;
  if (!session) return <AuthPage />;
  if (profileError)
    return (
      <div className="client-page" style={{ maxWidth: 480, margin: "40px auto" }}>
        <ErrorBox error={profileError} />
        <button className="btn mt-12" onClick={signOut}>
          Sign out
        </button>
      </div>
    );

  if (profile.role === "coach") {
    return (
      <Routes>
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:id" element={<ProgramPage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="workouts/:id" element={<WorkoutBuilderPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="profile" element={<CoachProfilePage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:clientId" element={<InboxPage />} />
          <Route path="calendar" element={<EventsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/coach" replace />} />
      </Routes>
    );
  }

  if (!profile.onboarded_at) return <WelcomeFlow />;

  return (
    <Routes>
      <Route path="/app/workout/:dayId" element={<WorkoutPlayer />} />
      <Route path="/app" element={<ClientLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="me" element={<MePage />} />
        <Route path="journey" element={<JourneyPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="checkin" element={<CheckinPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
