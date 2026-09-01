import { redirect } from "next/navigation";

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
      </div>
    </main>
  );
}
