import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { isConfigured } from "./lib/supabase";
import { AuthProvider } from "./auth/AuthProvider";
import { SetupPending } from "./auth/AuthPage";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SetupPending />
    )}
  </StrictMode>,
);

// Kept for push notifications (coming in a later phase).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
