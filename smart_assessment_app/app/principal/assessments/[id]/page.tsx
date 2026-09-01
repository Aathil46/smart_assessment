"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function PrincipalAssessmentResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/principal/assessments/${id}/results`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch results");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        router.back();
      });
  }, [id, router]);

  const generateReview = async () => {
    setGeneratingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/principal/assessments/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passed: data.overview.passed,
          failed: data.overview.failed,
          weakConcepts: data.weakConcepts.map((c: any) => c.concept),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d?.error?.message ?? "Unable to generate AI review.");
      }
      if (d.review) setAiReview(d.review);
      else throw new Error("AI review generation returned no review.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to generate AI review.");
    } finally {
      setGeneratingReview(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-slate-500">Loading assessment summary...</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to Teacher
        </button>
      </div>

      <div className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {data.assessment.class_name} • {data.assessment.teacher_name}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.assessment.title}</h1>
        <p className="mt-2 text-slate-600">Overview of student performance and weak concepts.</p>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Students</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.overview.totalStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{data.overview.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">Passed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{data.overview.passed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-red-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-red-700">Failed</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{data.overview.failed}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Concept Analytics</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">Concept</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Accuracy</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.weakConcepts.map((c: any) => (
                  <tr key={c.concept}>
                    <td className="px-6 py-4 font-medium text-slate-900">{c.concept}</td>
                    <td className="px-6 py-4 text-slate-600">{c.accuracyPercentage}%</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        {c.level}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.mediumConcepts.map((c: any) => (
                  <tr key={c.concept}>
                    <td className="px-6 py-4 font-medium text-slate-900">{c.concept}</td>
                    <td className="px-6 py-4 text-slate-600">{c.accuracyPercentage}%</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {c.level}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.weakConcepts.length === 0 && data.mediumConcepts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No weak or medium concepts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">AI Review</h2>
            {aiReview ? (
              <div className="rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
                {aiReview}
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-slate-500">
                  Generate an AI summary of this assessment using aggregated data only.
                </p>
                {reviewError ? <p className="mb-4 text-sm text-red-600">{reviewError}</p> : null}
                <button
                  onClick={generateReview}
                  disabled={generatingReview}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {generatingReview ? "Generating..." : "Generate AI Review"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
