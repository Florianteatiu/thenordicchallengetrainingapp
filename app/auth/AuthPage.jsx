import { useState } from "react";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { COACH_FIRST_NAME } from "../config";

function Shell({ children }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="center mb-16">
          <img src={logo} alt="" style={{ width: 64, height: 64, margin: "0 auto 14px" }} />
          <div className="h1">The Nordic Challenge</div>
          <div className="muted mt-8">Train with Florian</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function switchMode(m) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setNotice("Almost there! Check your inbox and tap the link to confirm your email, then sign in.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <Shell>
        <div className="card col gap-16">
          <div className="h2">Forgot your password?</div>
          <p className="muted" style={{ margin: 0 }}>
            No problem. Send {COACH_FIRST_NAME} a message and he'll give you a temporary password. Sign in with it and the app will ask you to
            choose a new one.
          </p>
          <p className="small faint" style={{ margin: 0 }}>
            All your workouts and progress stay exactly as they are.
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => switchMode("signin")}>
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form className="card col gap-16" onSubmit={submit}>
        <div className="h2">{mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}</div>
        {mode === "signup" && (
          <label className="field">
            <span>Your name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== "forgot" && (
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
        )}
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="ok-box">{notice}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
        <div className="col gap-6 center small">
          {mode === "signin" && (
            <>
              <button type="button" className="link-btn" onClick={() => switchMode("signup")}>
                New here? Create an account
              </button>
              <button type="button" className="link-btn" style={{ color: "var(--text-2)" }} onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
            </>
          )}
          {mode !== "signin" && (
            <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

// Shown after an email reset link (onDone = finishRecovery) and after signing
// in with a temporary password from the coach (intro + onDone passed in).
export function SetNewPassword({ intro, onDone }) {
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await (onDone ?? finishRecovery)();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Shell>
      <form className="card col gap-16" onSubmit={submit}>
        <div className="h2">Choose a new password</div>
        {intro && <p className="muted" style={{ margin: 0 }}>{intro}</p>}
        <label className="field">
          <span>New password (at least 8 characters)</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
        {onDone && (
          <button type="button" className="link-btn small" style={{ color: "var(--text-2)" }} onClick={signOut}>
            Sign out
          </button>
        )}
      </form>
    </Shell>
  );
}

export function SetupPending() {
  return (
    <Shell>
      <div className="card">
        <div className="h3">Almost ready</div>
        <p className="muted small">The app isn't connected to its database yet. This screen disappears as soon as the setup is finished.</p>
      </div>
    </Shell>
  );
}
