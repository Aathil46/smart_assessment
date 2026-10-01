import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { TeacherShell } from "@/components/bolt/TeacherShell";
import { requireTeacherSession } from "@/lib/auth/teacher";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  try {
    await requireTeacherSession();
  } catch {
    redirect("/login");
  }

  return <TeacherShell>{children}</TeacherShell>;
}