"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

/* ---------- Types matching the backend API response ---------- */

type ConceptPerf = {
  concept: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  accuracyPercentage: number;
  level: "Strong" | "Medium" | "Weak";
};

type LearningGap = {
  concept: string;
  gap_level: string;
  notes: string | null;
  recommendations: string[];
};

type AttemptInfo = {
  id: string;
  assessment_id: string;
  score: number;
  total: number;
  percentage: number;
  passFail: "Pass" | "Fail";
  isWeakStudent: boolean;
  submitted_at: string | null;
  started_at: string;
};

type AssessmentInfo = {
  title: string;
  topic: string | null;
};

type ResultData = {
  status?: string;
  message?: string;
  attempt: AttemptInfo;
  assessment: AssessmentInfo | null;
  conceptPerformance: ConceptPerf[];
  gaps: LearningGap[];
  error?: { code: string; message: string };
};

/* ---------- Visual helpers ---------- */

const LEVEL_CONFIG = {
  Strong: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    barColor: "bg-emerald-500",
  },
  Medium: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    barColor: "bg-amber-500",
  },
  Weak: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800",
    barColor: "bg-red-500",
  },
} as const;

function getLevelConfig(level: string) {
  return LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.Medium;
}

/* ---------- Component ---------- */

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/results/student/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load result.");
        return r.json();
      })
      .then((d) => {
        if (d.error) {
          setError(d.error.message ?? "Unable to load result.");
        } else {
          setData(d);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  /* Loading state */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-slate-500">Loading your results…</p>
        </div>
      </main>
    );
  }

  /* Error state */
  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-xl font-semibold text-red-800">
            Unable to load result
          </h1>
          <p className="mt-2 text-red-600">{error ?? "Please try again."}</p>
          <Link
            href="/student"
            className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  /* In-progress state */
  if (data.status === "in_progress" || !data.attempt.submitted_at) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-xl font-semibold text-amber-800">
            Assessment In Progress
          </h1>
          <p className="mt-2 text-amber-600">
            {data.message ?? "This assessment has not been submitted yet."}
          </p>
          <Link
            href="/student"
            className="mt-6 inline-block rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { attempt, assessment, conceptPerformance, gaps } = data;
  const isPassed = attempt.passFail === "Pass";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Back link */}
      <Link
        href="/student"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Back to Dashboard
      </Link>

      {/* ─── Header: Assessment title ─── */}
      <header className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {assessment?.title ?? "Assessment Result"}
        </h1>
        {assessment?.topic && (
          <p className="mt-1 text-slate-500">{assessment.topic}</p>
        )}
      </header>

      {/* ─── Overall Score Card ─── */}
      <section
        id="overall-score"
        className={`mt-8 rounded-2xl border-2 p-6 ${
          isPassed
            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
            : "border-red-200 bg-gradient-to-br from-red-50 to-white"
        }`}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
              Your Score
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-slate-900">
              {attempt.score}{" "}
              <span className="text-xl font-medium text-slate-400">
                / {attempt.total}
              </span>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-700">
              {attempt.percentage}%
            </p>
          </div>

          <div className="text-center">
            <span
              className={`inline-block rounded-full px-5 py-2 text-lg font-bold ${
                isPassed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {attempt.passFail}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Concept Performance ─── */}
      {conceptPerformance.length > 0 && (
        <section id="concept-performance" className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">
            Concept Performance
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            How you performed across each concept in this assessment
          </p>

          <div className="mt-5 space-y-3">
            {conceptPerformance.map((cp) => {
              const config = getLevelConfig(cp.level);
              return (
                <div
                  key={cp.concept}
                  className={`rounded-xl border p-4 ${config.bg} ${config.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        {cp.concept}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {cp.correctCount} / {cp.totalCount} correct
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold tabular-nums text-slate-800">
                        {cp.accuracyPercentage}%
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${config.badge}`}
                      >
                        {cp.level}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
                      style={{
                        width: `${Math.min(cp.accuracyPercentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Learning Gaps ─── */}
      {gaps.length > 0 && (
        <section id="learning-gaps" className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">
            <span className="mr-2">⚠</span>
            Learning Gaps
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These concepts need your attention — review them to improve your
            understanding
          </p>

          <div className="mt-5 space-y-4">
            {gaps.map((gap) => (
              <div
                key={gap.concept}
                className="rounded-xl border-2 border-red-200 bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm text-red-600">
                    !
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-red-800">{gap.concept}</h3>

                    {gap.notes ? (
                      <p className="mt-2 leading-relaxed text-slate-600">
                        {gap.notes}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-slate-400">
                        Review the {gap.concept} section of your learning
                        material to strengthen this area.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── No gaps message ─── */}
      {gaps.length === 0 && conceptPerformance.length > 0 && (
        <section className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="font-semibold text-emerald-800">
            🎉 No learning gaps detected!
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            Great work — you demonstrated solid understanding across all
            concepts.
          </p>
        </section>
      )}

      {/* ─── Footer ─── */}
      <div className="mt-10 border-t border-slate-200 pt-6 text-center">
        <Link
          href="/student"
          className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}