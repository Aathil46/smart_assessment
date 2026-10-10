import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { StudentShell } from "@/components/bolt/StudentShell";
import { requireStudentSession } from "@/lib/auth/student";

export default async function StudentProfileLayout({ children }: { children: ReactNode }) {
  let sessionData;
  try {
    sessionData = await requireStudentSession();
  } catch {
    redirect("/login");
  }

  return <StudentShell profile={sessionData.profile}>{children}</StudentShell>;
}
