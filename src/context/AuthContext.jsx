import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId, user) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      console.error("Failed to load profile", error);
      setProfile(null);
      return;
    }
    if (data) {
      setProfile(data);
      return;
    }
    // No profile row yet — this happens when email confirmation delayed
    // profile creation until the user's first real sign-in. Finish it now
    // using the role/name they chose at signup time.
    const pendingRaw = window.localStorage.getItem("pendingProfile");
    if (pendingRaw && user) {
      try {
        const pending = JSON.parse(pendingRaw);
        const created = await ensureProfile(user, pending);
        window.localStorage.removeItem("pendingProfile");
        setProfile(created);
        return;
      } catch (e) {
        console.error("Failed to finish pending profile creation", e);
      }
    }
    setProfile(null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id, data.session?.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadProfile(newSession?.user?.id, newSession?.user);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signUp({ email, password, name, role }) {
    window.localStorage.setItem("pendingProfile", JSON.stringify({ name, role }));

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      window.localStorage.removeItem("pendingProfile");
      throw error;
    }
    const user = data.user;
    if (!user || !data.session) {
      // Email confirmation required before a session exists — the profile
      // row gets created on first real sign-in instead (see loadProfile).
      return { needsEmailConfirmation: true };
    }

    const created = await ensureProfile(user, { name, role });
    window.localStorage.removeItem("pendingProfile");
    setProfile(created);
    return { needsEmailConfirmation: false };
  }

  async function ensureProfile(user, fallback) {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (existing) return existing;
    if (!fallback) return null;

    let coachId = null;
    if (fallback.role === "client") {
      const { data: coach } = await supabase.from("profiles").select("id").eq("role", "coach").limit(1).maybeSingle();
      coachId = coach?.id ?? null;
    }
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, role: fallback.role, name: fallback.name, email: user.email, coach_id: coachId })
      .select()
      .single();
    if (error) throw error;
    return created;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile(data.user.id, data.user);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (session?.user?.id) await loadProfile(session.user.id, session.user);
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
    ensureProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
