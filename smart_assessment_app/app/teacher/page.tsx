import Link from "next/link";
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
      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">AI Smart Assessment</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Teacher Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage your classes, learning materials, and assessments.</p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Teacher navigation">
          <Link href="/teacher" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Dashboard</Link>
          <Link href="/teacher/classes" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Classes</Link>
          <Link href="/teacher/assessments/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create Assessment</Link>
        </nav>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        <Link href="/teacher/classes" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <h2 className="text-xl font-semibold text-slate-900">My Classes</h2>
          <p className="mt-2 text-sm text-slate-600">Create and manage classes, join codes, and learning materials.</p>
          <span className="mt-5 inline-block text-sm font-medium text-blue-600">Open Classes →</span>
        </Link>
        <Link href="/teacher/assessments/new" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <h2 className="text-xl font-semibold text-slate-900">Create Assessment</h2>
          <p className="mt-2 text-sm text-slate-600">Create an assessment and publish it for your students.</p>
          <span className="mt-5 inline-block text-sm font-medium text-blue-600">Create Assessment →</span>
        </Link>
      </section>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <strong>Workflow:</strong> Create a class → add learning material → create/publish an assessment → open Results after students submit.
      </div>
    </main>
  );
}
