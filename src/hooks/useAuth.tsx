import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { waitForAuthenticatedSession } from "@/lib/auth-session";
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next?.user) {
        setTimeout(() => {
          void loadProfile(next.user.id);
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
      if (restoredSession?.user) await loadProfile(restoredSession.user.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
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
