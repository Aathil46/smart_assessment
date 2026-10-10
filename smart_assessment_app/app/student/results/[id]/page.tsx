"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Award,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  Info,
  Lightbulb,
} from "lucide-react";
import { RecommendedVideosSection } from "@/components/bolt/student/RecommendedVideosSection";

interface ConceptItem {
  concept: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  accuracyPercentage: number;
  level: "Strong" | "Medium" | "Weak";
}

interface LearningGap {
  concept: string;
  gap_level: string;
  notes: string | null;
  recommendations: string[];
}

interface ResultData {
  status?: string;
  message?: string;
  attempt: {
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
  assessment: {
    id: string;
    title: string;
    topic: string | null;
    className: string;
    subject: string;
    teacher: string;
  };
  totalQuestions: number;
  correctAnswers: number;
  conceptPerformance: ConceptItem[];
  strongConcepts: ConceptItem[];
  mediumConcepts: ConceptItem[];
  weakConcepts: ConceptItem[];
  gaps: LearningGap[];
  error?: { code: string; message: string };
}

export default function StudentResultDetailPage({
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
    setError(null);
    fetch(`/api/results/student/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Unable to load result.");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error loading result."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <div className="h-6 w-32 rounded bg-slate-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white border border-slate-200 p-8 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-slate-200 p-8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200 p-6 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
          <h1 className="text-xl font-bold text-rose-900">Result Not Found</h1>
          <p className="mt-2 text-sm text-rose-600">{error || "Unable to find the requested assessment result."}</p>
          <Link
            href="/student/results"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Results
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "in_progress" || !data.attempt.submitted_at) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <HelpCircle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
          <h1 className="text-xl font-bold text-amber-900">Assessment In Progress</h1>
          <p className="mt-2 text-sm text-amber-700">
            {data.message || "This assessment has not been submitted yet. Please complete it to see your results."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/student/results"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Back to Results
            </Link>
            <Link
              href={`/student/assessments/${data.attempt.assessment_id}/take`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Resume Assessment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { attempt, assessment, totalQuestions, correctAnswers, strongConcepts, mediumConcepts, weakConcepts, gaps } = data;
  const isPassed = attempt.passFail === "Pass";

  const formattedDate = attempt.submitted_at
    ? new Date(attempt.submitted_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* ─── Back Link ─── */}
      <div>
        <Link
          href="/student/results"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Results
        </Link>
      </div>

      {/* ─── Header: Assessment Information ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {assessment.subject}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                {assessment.className}
              </span>
              {assessment.topic && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                  Topic: {assessment.topic}
                </span>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">{assessment.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                Teacher: {assessment.teacher}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Submitted: {formattedDate}
              </span>
            </div>
          </div>

          {/* Pass / Fail Big Pill */}
          <div className="shrink-0 self-start md:self-auto">
            <span
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold shadow-sm ${
                isPassed
                  ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-300"
                  : "bg-rose-50 text-rose-700 border-2 border-rose-300"
              }`}
            >
              {isPassed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600" />}
              {attempt.passFail}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Score Summary Card ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Score</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {correctAnswers}{" "}
            <span className="text-lg font-medium text-slate-400">/ {totalQuestions}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Questions Answered Correctly</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Percentage</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{attempt.percentage}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isPassed ? "bg-emerald-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(attempt.percentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Questions</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{totalQuestions}</p>
          <p className="mt-1 text-xs text-slate-500">In this assessment</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Concepts Evaluated</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {strongConcepts.length + mediumConcepts.length + weakConcepts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {strongConcepts.length} strong · {weakConcepts.length} weak
          </p>
        </div>
      </div>

      {/* ─── Workflow Step 4: Concept Analysis ─── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Concept Analysis
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your performance breakdown divided across Strong, Medium, and Weak concept levels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Strong Concepts */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-emerald-950">Strong Concepts</h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {strongConcepts.length}
              </span>
            </div>

            <p className="mt-2 text-2xs text-emerald-700">Mastery ≥ 80% • Solid understanding</p>

            <div className="mt-4 space-y-3 flex-1">
              {strongConcepts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6 text-xs text-slate-400 italic">
                  No concepts in this category.
                </div>
              ) : (
                strongConcepts.map((c) => (
                  <div key={c.concept} className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{c.concept}</p>
                      <span className="shrink-0 text-sm font-bold text-emerald-700 tabular-nums">
                        {c.accuracyPercentage}%
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-slate-500">
                      {c.correctCount} / {c.totalCount} correct
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(c.accuracyPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Medium Concepts */}
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Info className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-amber-950">Medium Concepts</h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {mediumConcepts.length}
              </span>
            </div>

            <p className="mt-2 text-2xs text-amber-700">50% – 79% • Needs practice</p>

            <div className="mt-4 space-y-3 flex-1">
              {mediumConcepts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6 text-xs text-slate-400 italic">
                  No concepts in this category.
                </div>
              ) : (
                mediumConcepts.map((c) => (
                  <div key={c.concept} className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{c.concept}</p>
                      <span className="shrink-0 text-sm font-bold text-amber-700 tabular-nums">
                        {c.accuracyPercentage}%
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-slate-500">
                      {c.correctCount} / {c.totalCount} correct
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${Math.min(c.accuracyPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Weak Concepts */}
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-rose-200">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-rose-950">Weak Concepts</h3>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                {weakConcepts.length}
              </span>
            </div>

            <p className="mt-2 text-2xs text-rose-700">&lt; 50% • Priority review area</p>

            <div className="mt-4 space-y-3 flex-1">
              {weakConcepts.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center flex flex-col items-center justify-center h-full">
                  <Sparkles className="h-6 w-6 text-emerald-600 mb-2" />
                  <p className="text-xs font-semibold text-emerald-900">Zero Weak Concepts!</p>
                  <p className="text-2xs text-emerald-700 mt-1">
                    You demonstrated solid understanding across all evaluated concepts.
                  </p>
                </div>
              ) : (
                weakConcepts.map((c) => (
                  <div key={c.concept} className="rounded-xl border border-rose-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{c.concept}</p>
                      <span className="shrink-0 text-sm font-bold text-rose-700 tabular-nums">
                        {c.accuracyPercentage}%
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-slate-500">
                      {c.correctCount} / {c.totalCount} correct
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${Math.min(c.accuracyPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Workflow Step 5: Learning Gaps & Actionable Recommendations ─── */}
      <section className="space-y-4 pt-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Learning Gaps & Recommendations
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Targeted insights identified from your assessment attempt to help close knowledge gaps.
          </p>
        </div>

        {gaps.length === 0 && weakConcepts.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <Award className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
            <h3 className="text-base font-bold text-emerald-900">No Learning Gaps Detected</h3>
            <p className="text-sm text-emerald-700 mt-1 max-w-lg mx-auto">
              Outstanding work! You demonstrated complete mastery across all concepts tested in this assessment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {gaps.map((gap) => (
              <div
                key={gap.concept}
                className="rounded-2xl border-2 border-rose-200 bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700 shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{gap.concept}</h3>
                  </div>
                  <span className="inline-flex items-center self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    Gap Level: {gap.gap_level}
                  </span>
                </div>

                {gap.notes && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Concept Evaluation Note
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      {gap.notes}
                    </p>
                  </div>
                )}

                {gap.recommendations && gap.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Recommended Steps
                    </h4>
                    <ul className="space-y-2">
                      {gap.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xs font-bold text-blue-700 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* Fallback if weak concepts exist but no explicit learning gap notes recorded */}
            {gaps.length === 0 && weakConcepts.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Info className="h-5 w-5 text-amber-600" />
                  <h3>Identified Areas For Review</h3>
                </div>
                <p className="text-sm text-slate-700">
                  Review the learning materials for the following weak concepts:
                </p>
                <div className="flex flex-wrap gap-2">
                  {weakConcepts.map((wc) => (
                    <span
                      key={wc.concept}
                      className="px-3 py-1 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      {wc.concept} ({wc.accuracyPercentage}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Workflow Step 6: Recommended Educational Videos ─── */}
      <RecommendedVideosSection attemptId={data.attempt.id} />

      {/* ─── Footer Action ─── */}
      <div className="pt-6 border-t border-slate-200 flex justify-center">
        <Link
          href="/student/results"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
        >
          Back to My Results
        </Link>
      </div>
    </div>
  );
}