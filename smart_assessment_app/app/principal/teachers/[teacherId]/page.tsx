"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function PrincipalTeacherPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const [data, setData] = useState<{ teacherName: string; assessments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/principal/teachers/${teacherId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        router.back();
      });
  }, [teacherId, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-500">Loading assessments...</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/principal" className="text-sm font-medium text-blue-600 hover:underline">
          Dashboard
        </Link>
        <button onClick={() => router.back()} className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Back
        </button>
      </div>

      <div className="mb-8 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Assessments</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.teacherName}</h1>
      </div>

      {data.assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No published assessments found for this teacher.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.assessments.map((assessment) => (
            <Link
              key={assessment.id}
              href={`/principal/assessments/${assessment.id}`}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="text-lg font-bold text-slate-800">{assessment.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{assessment.topic || "General Topic"}</p>
              
              <div className="mt-4 flex items-center gap-2">
                {assessment.grade && (
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    Grade {assessment.grade}
                  </span>
                )}
                {assessment.subject && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {assessment.subject}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
