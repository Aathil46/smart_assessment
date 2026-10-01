import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const ROLE_DASHBOARDS: Record<string, string> = {
  teacher: "/teacher",
  student: "/student/classes",
  principal: "/principal",
};

export default async function HomePage() {
  // If the user already has a valid session, redirect them to their dashboard.
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
      const dashboard = profile?.role ? ROLE_DASHBOARDS[profile.role] : null;
      if (dashboard) {
        redirect(dashboard);
      }
    }
  } catch {
    // Not authenticated or env vars missing — fall through to landing page.
  }

  return redirect("/login");
}
