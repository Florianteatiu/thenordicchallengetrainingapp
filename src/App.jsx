import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import ResetPasswordForm from "./pages/ResetPasswordForm";
import CoachDashboard from "./coach/CoachDashboard";
import PTApp from "./client/PTApp";
import { C, fontStack } from "./theme";

function Root() {
  const { session, profile, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <div style={{ fontFamily: fontStack, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.paperMuted, color: C.textSecondary }}>
        Loading...
      </div>
    );
  }

  // Clicking a "reset your password" email link signs the user in
  // temporarily and fires this — show the reset form before anything else,
  // regardless of role.
  if (passwordRecovery) return <ResetPasswordForm />;

  if (!session) return <AuthPage />;

  if (!profile) {
    return (
      <div style={{ fontFamily: fontStack, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.paperMuted, color: C.textSecondary }}>
        Setting up your account...
      </div>
    );
  }

  if (profile.role === "coach") return <CoachDashboard />;

  return (
    <div style={{ fontFamily: fontStack, minHeight: "100vh", background: C.paperMuted, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <PTApp />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
