import { redirect } from "next/navigation";

import { StudentShell } from "@/components/bolt/StudentShell";
import { StudentAssessments } from "@/components/bolt/student/StudentAssessments";
import { requireStudentSession } from "@/lib/auth/student";

export default async function StudentAssessmentsPage() {
  try {
    await requireStudentSession();
  } catch {
    redirect("/login");
  }

  return (
    <StudentShell>
      <StudentAssessments />
    </StudentShell>
  );
}
