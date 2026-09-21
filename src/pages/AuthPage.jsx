import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, fontStack, inputStyle } from "../theme";
import logo from "../assets/logo.png";

export default function AuthPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        await sendPasswordReset(email);
        setInfo("Check your email for a link to reset your password.");
      } else if (mode === "login") {
        await signIn({ email, password });
      } else {
        const result = await signUp({ email, password, name });
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
      <div style={{ width: "100%", maxWidth: 380, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src={logo} alt="" style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4 }}>THE NORDIC CHALLENGE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.textPrimary }}>Training app</div>
          </div>
        </div>

        {mode !== "forgot" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            <button
              onClick={() => { setMode("login"); setError(""); setInfo(""); }}
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
              onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
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
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <>
              <div style={{ fontSize: 12, color: C.textSecondary }}>Creating an account signs you up as an athlete, linked to your coach.</div>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your full name" />
              </div>
            </>
          )}
          {mode === "forgot" && (
            <div style={{ fontSize: 12, color: C.textSecondary }}>Enter your email and we'll send you a link to reset your password.</div>
          )}
          <div>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
          </div>
          {mode !== "forgot" && (
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
          )}
          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
              style={{ alignSelf: "flex-end", background: "none", border: "none", cursor: "pointer", color: C.textSecondary, fontSize: 12, textDecoration: "underline", padding: 0 }}
            >
              Forgot password?
            </button>
          )}

          {error && <div style={{ fontSize: 12.5, color: C.danger, background: C.dangerSoft, borderRadius: 6, padding: "8px 10px" }}>{error}</div>}
          {info && <div style={{ fontSize: 12.5, color: C.success, background: C.successSoft, borderRadius: 6, padding: "8px 10px" }}>{info}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              background: C.signal,
              color: C.onSignal,
              border: "none",
              borderRadius: 8,
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setInfo(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textSecondary, fontSize: 12.5, textDecoration: "underline", padding: 0 }}
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
