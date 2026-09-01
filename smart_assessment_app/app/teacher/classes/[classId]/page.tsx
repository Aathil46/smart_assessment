import Link from "next/link";

import { requireTeacherSession } from "@/lib/auth/teacher";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RetryMaterialButton from "./RetryMaterialButton";

export default async function TeacherClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  await requireTeacherSession();
  const supabase = await createServerSupabaseClient();

  const { data: klass } = await supabase.from("classes").select("*").eq("id", classId).single();
  const { data: materials } = await supabase.from("materials").select("*").eq("class_id", classId).order("created_at", { ascending: false });
  const { data: assessments } = await supabase.from("assessments").select("*").eq("class_id", classId).order("created_at", { ascending: false });

  if (!klass) {
    return <main className="mx-auto max-w-4xl px-6 py-10 text-slate-700">Class not found.</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Class overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{klass.name}</h1>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">Join code: {klass.code}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/teacher/classes/${klass.id}/materials`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Manage materials
          </Link>
          <Link
            href="/teacher/classes"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to classes
          </Link>
          <Link
            href={`/teacher/assessments/new?classId=${klass.id}`}
            className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Create assessment
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Materials</h2>
        <div className="mt-4 space-y-3">
          {(materials ?? []).map((material) => (
            <div key={material.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{material.title}</p>
                  <p className="text-sm text-slate-500">{material.file_name}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{material.status}</span>
                  {material.status === "failed" ? <RetryMaterialButton materialId={material.id} /> : null}
                </div>
              </div>
            </div>
          ))}

          {(!materials || materials.length === 0) && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              No materials yet.
            </div>
          )}
        </div>
      </section>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Assessments</h2>
        <div className="mt-4 space-y-3">
          {(assessments ?? []).map((assessment) => (
            <div key={assessment.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{assessment.title}</p>
                  <p className="text-sm text-slate-500">{assessment.topic ?? "No topic"}</p>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${assessment.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                    {assessment.status}
                  </span>
                  {assessment.status === "draft" ? (
                    <Link
                      href={`/teacher/assessments/${assessment.id}/edit`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                  ) : (
                    <Link
                      href={`/teacher/assessments/${assessment.id}/results`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Results
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(!assessments || assessments.length === 0) && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              No assessments yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
