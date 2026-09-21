import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import CoachDashboard from "./coach/CoachDashboard";
import PTApp from "./client/PTApp";
import { C, fontStack } from "./theme";

function Root() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ fontFamily: fontStack, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.paperMuted, color: C.textSecondary }}>
        Loading...
      </div>
    );
  }

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
