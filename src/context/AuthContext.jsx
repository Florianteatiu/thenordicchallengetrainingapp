import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

const COACH_ID = import.meta.env.VITE_COACH_ID || null;

async function createClientRow(user, name) {
  const { data, error } = await supabase
    .from("clients")
    .insert({ id: user.id, name, email: user.email, coach_id: COACH_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role: "coach" | "client", ...row }
  const [loading, setLoading] = useState(true);

  // There's no unified "profiles" table — a signed-in user is either a row
  // in `coaches` or a row in `clients` (by matching auth.uid() = id).
  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }

    const { data: coachRow, error: coachError } = await supabase.from("coaches").select("*").eq("id", user.id).maybeSingle();
    if (coachError) console.error("Failed to check coach account", coachError);
    if (coachRow) {
      setProfile({ role: "coach", ...coachRow });
      return;
    }

    const { data: clientRow, error: clientError } = await supabase.from("clients").select("*").eq("id", user.id).maybeSingle();
    if (clientError) console.error("Failed to check client account", clientError);
    if (clientRow) {
      setProfile({ role: "client", ...clientRow });
      return;
    }

    // Neither row exists yet — this happens when email confirmation delayed
    // the client row's creation until this, the athlete's first real sign-in.
    const pendingName = window.localStorage.getItem("pendingClientName");
    if (pendingName) {
      try {
        const created = await createClientRow(user, pendingName);
        window.localStorage.removeItem("pendingClientName");
        setProfile({ role: "client", ...created });
        return;
      } catch (e) {
        console.error("Failed to finish pending signup", e);
      }
    }
    setProfile(null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadProfile(newSession?.user);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Athlete self-signup only — the one coach account is provisioned manually
  // (see README "Coach setup"), since there's no INSERT policy for `coaches`.
  async function signUp({ email, password, name }) {
    window.localStorage.setItem("pendingClientName", name);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      window.localStorage.removeItem("pendingClientName");
      throw error;
    }
    const user = data.user;
    if (!user || !data.session) {
      // Email confirmation required before a session exists — the client
      // row gets created on first real sign-in instead (see loadProfile).
      return { needsEmailConfirmation: true };
    }

    const created = await createClientRow(user, name);
    window.localStorage.removeItem("pendingClientName");
    setProfile({ role: "client", ...created });
    return { needsEmailConfirmation: false };
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile(data.user);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
