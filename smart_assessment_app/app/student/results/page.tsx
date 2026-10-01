"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  FileText,
  AlertCircle,
  Award,
  Layers,
} from "lucide-react";

interface EnrolledClass {
  id: string;
  name: string;
  subject: string;
  grade: string;
  code: string;
  teacher: string;
  totalAssessments: number;
  completedAssessments: number;
  avgScore: number | null;
}

interface ClassAssessment {
  id: string;
  title: string;
  topic: string | null;
  questionCount: number;
  date: string;
  status: "completed" | "in_progress" | "not_attempted";
  score: {
    score: number;
    total: number;
    percentage: number;
    passFail: "Pass" | "Fail";
  } | null;
  attemptId: string | null;
  hasResult: boolean;
}

export default function StudentResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const classIdFromUrl = searchParams.get("classId");

  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<EnrolledClass | null>(null);
  const [assessments, setAssessments] = useState<ClassAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch all enrolled classes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/results/student")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load classes.");
        setClasses(data.classes || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error loading classes."))
      .finally(() => setLoading(false));
  }, []);

  // 2. Fetch assessments when a class is selected
  useEffect(() => {
    if (!classIdFromUrl) {
      setSelectedClass(null);
      setAssessments([]);
      return;
    }

    setLoadingAssessments(true);
    fetch(`/api/results/student?classId=${classIdFromUrl}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load assessments.");
        setSelectedClass(data.class || null);
        setAssessments(data.assessments || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error loading assessments."))
      .finally(() => setLoadingAssessments(false));
  }, [classIdFromUrl]);

  const handleSelectClass = (clsId: string) => {
    startTransition(() => {
      router.push(`/student/results?classId=${clsId}`);
    });
  };

  const handleBackToClasses = () => {
    startTransition(() => {
      router.push("/student/results");
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse mb-3" />
          <div className="h-4 w-96 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !selectedClass && classes.length === 0) {
    return (
      <div className="mx-auto max-w-xl text-center py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
          <h2 className="text-lg font-semibold text-rose-800">Unable to Load Results</h2>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Workflow Step 2: Selected Class View ─── */}
      {classIdFromUrl && selectedClass ? (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={handleBackToClasses}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to All Classes
          </button>

          {/* Class Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedClass.subject}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {selectedClass.grade}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{selectedClass.name}</h1>
                <p className="mt-1 text-sm text-slate-500">Teacher: {selectedClass.teacher}</p>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-center px-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Assessments</p>
                  <p className="text-xl font-bold text-slate-900">{assessments.length}</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-center px-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Completed</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {assessments.filter((a) => a.status === "completed").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assessments List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Class Assessments & Results</h2>
              <span className="text-xs text-slate-500">{assessments.length} total assessments</span>
            </div>

            {loadingAssessments ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-white border border-slate-200 p-4 animate-pulse" />
                ))}
              </div>
            ) : assessments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No assessments yet</h3>
                <p className="text-sm text-slate-500 mt-1">There are no published assessments for this class yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {assessments.map((item) => {
                  const isCompleted = item.status === "completed";
                  const isInProgress = item.status === "in_progress";

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              isCompleted
                                ? "bg-emerald-50 text-emerald-600"
                                : isInProgress
                                ? "bg-amber-50 text-amber-600"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : isInProgress ? (
                              <Clock className="h-5 w-5" />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </div>

                          <div>
                            <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                              {item.topic && <span>Topic: {item.topic}</span>}
                              {item.topic && <span>•</span>}
                              <span>{item.questionCount} questions</span>
                              <span>•</span>
                              <span>Date: {item.date}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status, Score & Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                          {isCompleted && item.score && (
                            <div className="text-left sm:text-right">
                              <div className="flex items-center sm:justify-end gap-2">
                                <span className="text-base font-bold text-slate-900">
                                  {item.score.score} / {item.score.total}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    item.score.passFail === "Pass"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {item.score.percentage}% ({item.score.passFail})
                                </span>
                              </div>
                              <span className="text-2xs text-slate-400">Score Achieved</span>
                            </div>
                          )}

                          {!isCompleted && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                isInProgress ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isInProgress ? "In Progress" : "Not Attempted"}
                            </span>
                          )}

                          {isCompleted && item.attemptId ? (
                            <Link
                              href={`/student/results/${item.attemptId}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                            >
                              View Result
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : isInProgress ? (
                            <Link
                              href={`/student/assessments/${item.id}/take`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
                            >
                              Resume
                            </Link>
                          ) : (
                            <Link
                              href={`/student/assessments/${item.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              Take
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── Workflow Step 1: All Joined Classes View ─── */
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">My Results</h1>
            <p className="mt-2 text-sm lg:text-base text-slate-600">
              Select any of your enrolled classes below to view assessment scores, concept analytics, and learning recommendations.
            </p>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <h2 className="text-lg font-semibold text-slate-800">No joined classes yet</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                You must join a class with a join code from your teacher to take assessments and view your performance results.
              </p>
              <Link
                href="/student/classes"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                Go to My Classes
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls) => {
                return (
                  <div
                    key={cls.id}
                    onClick={() => handleSelectClass(cls.id)}
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {cls.subject}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {cls.grade}
                        </span>
                      </div>

                      {/* Class Name */}
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {cls.name}
                      </h3>

                      {/* Teacher */}
                      <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        Teacher: {cls.teacher}
                      </p>

                      {/* Metrics Card */}
                      <div className="mt-5 grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div>
                          <p className="text-2xs font-medium uppercase tracking-wide text-slate-400">Completed</p>
                          <p className="mt-0.5 text-base font-bold text-slate-900">
                            {cls.completedAssessments}{" "}
                            <span className="text-xs font-normal text-slate-500">/ {cls.totalAssessments}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-2xs font-medium uppercase tracking-wide text-slate-400">Avg Score</p>
                          <p className="mt-0.5 text-base font-bold text-slate-900">
                            {cls.avgScore !== null ? `${cls.avgScore}%` : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-blue-600">
                      <span>View Assessments</span>
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
