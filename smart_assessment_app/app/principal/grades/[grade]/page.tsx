"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function PrincipalGradePage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = use(params);
  const [teachers, setTeachers] = useState<{ id: string; name: string; subjects: string[] }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/principal/grades/${grade}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((d) => {
        setTeachers(d.teachers);
        setLoading(false);
      })
      .catch(() => {
        router.push("/principal");
      });
  }, [grade, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-500">Loading teachers...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link href="/principal" className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to School
        </Link>
      </div>

      <div className="mb-8 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Grade {grade}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Teachers & Subjects</h1>
      </div>

      {teachers?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No teachers found for Grade {grade}.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {teachers?.map((teacher) => (
            <Link
              key={teacher.id}
              href={`/principal/teachers/${teacher.id}`}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="text-xl font-bold text-slate-800">{teacher.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {teacher.subjects.length > 0 ? (
                  teacher.subjects.map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No subjects listed</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
