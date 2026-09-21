import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, inputStyle } from "../theme";
import logo from "../assets/logo.png";

export default function ResetPasswordForm() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: fontStack, minHeight: "100vh", background: C.paperMuted, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src={logo} alt="" style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4 }}>THE NORDIC CHALLENGE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.textPrimary }}>Set a new password</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>New password</label>
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="At least 6 characters" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Confirm password</label>
            <input required type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          </div>

          {error && <div style={{ fontSize: 12.5, color: "#A6403C", background: "#F3E9E9", borderRadius: 6, padding: "8px 10px" }}>{error}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              background: C.signal,
              color: C.textPrimary,
              border: "none",
              borderRadius: 8,
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Saving..." : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
