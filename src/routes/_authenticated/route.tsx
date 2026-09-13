import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  allowBusinessMutations,
  blockBusinessMutations,
  waitForPendingBusinessMutations,
} from "@/lib/active-session";
import { checkCurrentUserActive } from "@/lib/active-user-check";
import { AppLayout } from "@/components/AppLayout";
import { waitForAuthenticatedSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const sessionResult = await waitForAuthenticatedSession();
    if (!sessionResult.session) throw redirect({ to: "/auth" });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const activeResult = await checkCurrentUserActive();
    if (activeResult.status === "inactive") {
      blockBusinessMutations();
      await waitForPendingBusinessMutations();
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { inactive: "1" } });
    }
    if (activeResult.status === "unavailable") {
      blockBusinessMutations();
      throw activeResult.error;
    }

    allowBusinessMutations();
    return { user: data.user };
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
