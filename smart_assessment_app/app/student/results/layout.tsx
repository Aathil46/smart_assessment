import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { StudentShell } from "@/components/bolt/StudentShell";
import { requireStudentSession } from "@/lib/auth/student";

export default async function StudentResultsLayout({ children }: { children: ReactNode }) {
  try {
    await requireStudentSession();
  } catch {
    redirect("/login");
  }

  return <StudentShell>{children}</StudentShell>;
}
