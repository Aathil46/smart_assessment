import { redirect } from "next/navigation";

import { TeacherDashboard } from "@/components/bolt/teacher/TeacherDashboard";
import { requireTeacherSession } from "@/lib/auth/teacher";

export default async function TeacherDashboardPage() {
  try {
    await requireTeacherSession();
  } catch {
    redirect("/login");
  }

  return <TeacherDashboard />;
}
