import { redirect } from "next/navigation";
import Link from "next/link";

import { requireTeacherSession } from "@/lib/auth/teacher";

export default async function TeacherDashboardPage() {
  try {
    await requireTeacherSession();
  } catch {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Teacher dashboard</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Manage classes, materials, and the assessment pipeline from this dashboard.
        </p>
        <nav className="mt-6 flex flex-wrap gap-3" aria-label="Teacher navigation">
          <Link
            href="/teacher/classes"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Manage classes
          </Link>
          <Link
            href="/teacher/assessments/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Create assessment
          </Link>
        </nav>
      </div>
    </main>
  );
}
