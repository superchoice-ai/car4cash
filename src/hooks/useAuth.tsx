import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { waitForAuthenticatedSession } from "@/lib/auth-session";
import {
  allowBusinessMutations,
  blockBusinessMutations,
  waitForPendingBusinessMutations,
} from "@/lib/active-session";
import { checkCurrentUserActive } from "@/lib/active-user-check";
import type { AppRole } from "@/lib/labels";

export interface Branch {
  id: string;
  code: string;
  name: string;
  district: string | null;
  is_hq: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  branch_id: string | null;
  active: boolean;
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  branch: Branch | null;
  roles: AppRole[];
  loading: boolean;
  isHQ: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canApprove: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const ACTIVE_POLL_MS = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, branch_id, active, branches:branch_id(id, code, name, district, is_hq)")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (p) {
      const { branches, ...rest } = p as unknown as Profile & { branches: Branch | null };
      setProfile(rest);
      setBranch(branches ?? null);
    } else {
      setProfile(null);
      setBranch(null);
    }
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    let mounted = true;
    let forcingLogout = false;

    const forceInactiveLogout = async () => {
      if (forcingLogout) return;
      forcingLogout = true;
      blockBusinessMutations();

      await waitForPendingBusinessMutations();
      await supabase.auth.signOut();

      if (mounted) {
        setSession(null);
        setProfile(null);
        setBranch(null);
        setRoles([]);
      }
      window.location.replace("/auth?inactive=1");
    };

    const checkActive = async (): Promise<boolean> => {
      const result = await checkCurrentUserActive();
      if (result.status === "unavailable") {
        blockBusinessMutations();
        console.error("[Auth] Active-user check unavailable", result.error);
        return false;
      }
      if (result.status === "inactive") {
        await forceInactiveLogout();
        return false;
      }
      allowBusinessMutations();
      return true;
    };

    const loadActiveProfile = async (next: Session) => {
      if (await checkActive()) await loadProfile(next.user.id);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next?.user) {
        setTimeout(() => {
          void loadActiveProfile(next);
        }, 0);
      } else {
        setProfile(null);
        setBranch(null);
        setRoles([]);
      }
    });

    void waitForAuthenticatedSession().then(async ({ session: restoredSession }) => {
      if (!mounted) return;
      setSession(restoredSession);
      if (restoredSession?.user) await loadActiveProfile(restoredSession);
      setLoading(false);
    });

    const checkCurrentSession = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) void checkActive();
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkCurrentSession();
    };

    const poll = window.setInterval(checkCurrentSession, ACTIVE_POLL_MS);
    window.addEventListener("focus", checkCurrentSession);
    window.addEventListener("online", checkCurrentSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(poll);
      window.removeEventListener("focus", checkCurrentSession);
      window.removeEventListener("online", checkCurrentSession);
      document.removeEventListener("visibilitychange", handleVisibility);
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBranch(null);
    setRoles([]);
  };

  const isAdmin = roles.includes("admin");
  const isHQ = isAdmin || !!branch?.is_hq;
  const isManager = isAdmin || roles.includes("manager");
  const canApprove = isManager || roles.includes("approver");

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        branch,
        roles,
        loading,
        isHQ,
        isAdmin,
        isManager,
        canApprove,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
