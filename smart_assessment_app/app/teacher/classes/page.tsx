import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireTeacherSession } from "@/lib/auth/teacher";

export default async function TeacherClassesPage() {
  await requireTeacherSession();
  const supabase = await createServerSupabaseClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/teacher" className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        &larr; Back to Dashboard
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Classes</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">My classes</h1>
        </div>
        <Link
          href="/teacher/classes/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Create class
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(classes ?? []).map((klass) => (
          <Link
            key={klass.id}
            href={`/teacher/classes/${klass.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-medium text-blue-600">{klass.subject ?? "General"}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{klass.name}</h2>
            <p className="mt-3 text-sm text-slate-500">Grade: {klass.grade ?? "N/A"}</p>
            <div className="mt-5 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">{klass.code}</div>
          </Link>
        ))}
      </div>

      {(!classes || classes.length === 0) && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-lg font-medium text-slate-700">No classes yet</p>
          <p className="mt-2 text-slate-500">Create your first class to get a join code and start the workflow.</p>
        </div>
      )}
    </main>
  );
}
