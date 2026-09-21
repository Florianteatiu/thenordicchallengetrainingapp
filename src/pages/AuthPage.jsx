import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, inputStyle } from "../theme";
import logo from "../assets/logo.png";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn({ email, password });
      } else {
        const result = await signUp({ email, password, name, role });
        if (result.needsEmailConfirmation) {
          setInfo("Check your email to confirm your account, then come back and sign in.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: fontStack,
        minHeight: "100vh",
        background: C.paperMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src={logo} alt="" style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4 }}>THE NORDIC CHALLENGE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.textPrimary }}>Training app</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 0",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              background: mode === "login" ? C.ink : C.paperMuted,
              color: mode === "login" ? "#fff" : C.textSecondary,
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode("signup")}
            style={{
              flex: 1,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 0",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              background: mode === "signup" ? C.ink : C.paperMuted,
              color: mode === "signup" ? "#fff" : C.textSecondary,
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your full name" />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Password</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="At least 6 characters"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, display: "block", marginBottom: 6 }}>I am a...</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "client", label: "Athlete" },
                  { id: "coach", label: "Coach" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRole(opt.id)}
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: 700,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: `1.5px solid ${role === opt.id ? C.signalText : C.line}`,
                      cursor: "pointer",
                      background: role === opt.id ? C.signalSoft : "#fff",
                      color: role === opt.id ? C.signalText : C.textSecondary,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 12.5, color: "#A6403C", background: "#F3E9E9", borderRadius: 6, padding: "8px 10px" }}>{error}</div>}
          {info && <div style={{ fontSize: 12.5, color: C.success, background: C.successSoft, borderRadius: 6, padding: "8px 10px" }}>{info}</div>}

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
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
