"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PrincipalDashboard() {
  const [data, setData] = useState<{ schoolName: string; grades: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/principal/schools")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-500">Loading school data...</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Principal Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.schoolName}</h1>
      </div>

      <h2 className="mb-4 text-xl font-semibold text-slate-800">Select a Grade</h2>
      
      {data.grades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No classes or grades found in this school.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.grades.map((grade) => (
            <Link
              key={grade}
              href={`/principal/grades/${grade}`}
              className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
            >
              Grade {grade}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
