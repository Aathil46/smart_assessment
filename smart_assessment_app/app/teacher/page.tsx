import { redirect } from "next/navigation";

import { TeacherDashboard } from "@/components/bolt/teacher/TeacherDashboard";
import { requireTeacherSession } from "@/lib/auth/teacher";

export const metadata = {
  title: "Teacher Dashboard | Smart Assessment",
  description: "Teacher overview of classes, students, assessment performance, and learning weaknesses.",
};

export default async function TeacherDashboardPage() {
  let sessionData;
  try {
    sessionData = await requireTeacherSession();
  } catch {
    redirect("/login");
  }

  return <TeacherDashboard initialTeacherName={sessionData.profile?.name} />;
}
