import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (userId) => {
    setProfileError(null);
    try {
      // The profile row is created by a database trigger at signup; give it
      // a moment on the very first sign-in.
      let p = await getProfile(userId);
      for (let i = 0; !p && i < 3; i++) {
        await new Promise((r) => setTimeout(r, 700));
        p = await getProfile(userId);
      }
      if (!p) throw new Error("Your profile couldn't be found. Try signing out and in again.");
      setProfile(p);
    } catch (e) {
      setProfileError(e);
    }
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) loadProfile(userId);
    else setProfile(null);
  }, [userId, loadProfile]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    setProfile,
    profileError,
    loading: session === undefined || (Boolean(session) && !profile && !profileError),
    recovering,
    finishRecovery: () => setRecovering(false),
    refreshProfile: () => userId && loadProfile(userId),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
