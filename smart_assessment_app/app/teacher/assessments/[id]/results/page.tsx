"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { type ClassPerformanceResult, type StudentResult } from "@/lib/analytics";

type ResultData = ClassPerformanceResult & {
  assessment: {
    id: string;
    title: string;
    topic: string | null;
    class_name: string;
  };
  error?: { message: string };
};

type IndividualStudentData = {
  status: "completed" | "in_progress" | "not_started";
  student: { id: string; name: string; email: string };
  assessment: { title: string; topic: string | null };
  attempt?: {
    id: string;
    score: number;
    total: number;
    percentage: number;
    passFail: "Pass" | "Fail";
    isWeakStudent: boolean;
    submittedAt: string;
  };
  conceptPerformance?: Array<{
    concept: string;
    correctCount: number;
    totalCount: number;
    accuracyPercentage: number;
    level: "Strong" | "Medium" | "Weak";
  }>;
  gaps?: Array<{
    concept: string;
    gap_level: string;
    notes: string;
    recommendations: string[];
  }>;
};

type FilterType = "All" | "Completed" | "In Progress" | "Failed" | "Weak";
type SortType = "most_recent" | "name_asc";

export default function TeacherResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search, Filter, Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [sortOption, setSortOption] = useState<SortType>("most_recent");

  // Individual Student Modal state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<IndividualStudentData | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  useEffect(() => {
    fetch(`/api/results/teacher/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error.message);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Open Student Detail
  const openStudentDetail = (studentId: string) => {
    setSelectedStudentId(studentId);
    setLoadingStudent(true);
    setStudentDetail(null);

    fetch(`/api/results/teacher/${id}/student/${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        setStudentDetail(d);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoadingStudent(false));
  };

  const closeStudentDetail = () => {
    setSelectedStudentId(null);
    setStudentDetail(null);
  };

  // Filtered & Sorted Student Results
  const processedStudents = useMemo(() => {
    if (!data?.studentResults) return [];

    let list = [...data.studentResults];

    // 1. Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }

    // 2. Filter
    if (activeFilter === "Completed") {
      list = list.filter((s) => s.status === "Completed");
    } else if (activeFilter === "In Progress") {
      list = list.filter((s) => s.status === "In Progress");
    } else if (activeFilter === "Failed") {
      list = list.filter((s) => s.status === "Completed" && s.passFail === "Fail");
    } else if (activeFilter === "Weak") {
      list = list.filter((s) => s.isWeakStudent);
    }

    // 3. Sort
    list.sort((a, b) => {
      if (sortOption === "most_recent") {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA; // most recent first
        return a.name.localeCompare(b.name);
      } else {
        return a.name.localeCompare(b.name); // A-Z
      }
    });

    return list;
  }, [data?.studentResults, searchTerm, activeFilter, sortOption]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-slate-500">Loading class results…</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-xl font-semibold text-red-800">Unable to load results</h1>
          <p className="mt-2 text-red-600">{error || "Something went wrong."}</p>
          <Link
            href="/teacher"
            className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { assessment, overview, weakConcepts, mediumConcepts } = data;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600"
      >
        &larr; Back to Dashboard
      </Link>

      <header className="mt-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-blue-600">
            {assessment.class_name}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {assessment.title}
          </h1>
          {assessment.topic && <p className="mt-1 text-slate-500">{assessment.topic}</p>}
        </div>
        <div>
          <a
            href={`/api/results/teacher/${id}/export`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <span>📊</span> Export Excel
          </a>
        </div>
      </header>

      {/* ─── OVERVIEW CARDS ─── */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Students</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{overview.totalStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{overview.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">In Progress</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{overview.inProgress}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-700">Passed</p>
          <p className="mt-1 text-3xl font-bold text-emerald-900">{overview.passed}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-red-700">Failed</p>
          <p className="mt-1 text-3xl font-bold text-red-900">{overview.failed}</p>
        </div>
      </section>

      {overview.completed === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-lg font-medium text-slate-700">No completed submissions yet.</p>
          <p className="mt-2 text-slate-500">Analytics will appear here once students submit the assessment.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* ─── WEAK CONCEPTS ─── */}
          <section>
            <h2 className="flex items-center gap-2 text-xl font-bold text-red-700">
              <span>⚠</span> You need to re-teach these weak concepts
            </h2>
            <div className="mt-4 space-y-4">
              {weakConcepts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No weak concepts detected for this assessment.
                </div>
              ) : (
                weakConcepts.map((wc) => (
                  <div key={wc.concept} className="rounded-xl border-2 border-red-200 bg-white p-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-900">{wc.concept}</h3>
                      <span className="rounded bg-red-100 px-2 py-1 text-sm font-bold text-red-800">
                        {wc.accuracyPercentage}%
                      </span>
                    </div>
                    <div className="pt-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Students affected ({wc.affectedStudents.length}):
                      </p>
                      {wc.affectedStudents.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                          {wc.affectedStudents.map((stu) => (
                            <li key={stu.student_id}>{stu.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400 italic">None</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ─── MEDIUM CONCEPTS ─── */}
          <section>
            <h2 className="text-xl font-bold text-amber-600">Medium Concepts (Needs Attention)</h2>
            <div className="mt-4 space-y-4">
              {mediumConcepts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No medium concepts requiring attention.
                </div>
              ) : (
                mediumConcepts.map((mc) => (
                  <div key={mc.concept} className="rounded-xl border-2 border-amber-200 bg-white p-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-900">{mc.concept}</h3>
                      <span className="rounded bg-amber-100 px-2 py-1 text-sm font-bold text-amber-800">
                        {mc.accuracyPercentage}%
                      </span>
                    </div>
                    <div className="pt-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Students affected ({mc.affectedStudents.length}):
                      </p>
                      {mc.affectedStudents.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                          {mc.affectedStudents.map((stu) => (
                            <li key={stu.student_id}>{stu.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400 italic">None</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* ─── STUDENT RESULTS SECTION ─── */}
      <section className="mt-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-slate-900">Student Results</h2>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="most_recent">Most recent submission</option>
              <option value="name_asc">A–Z (Student Name)</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(["All", "Completed", "In Progress", "Failed", "Weak"] as FilterType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                activeFilter === tab
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Student Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Score</th>
                  <th className="px-6 py-4 font-medium">Percentage</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      {searchTerm
                        ? "No students match your search."
                        : activeFilter !== "All"
                        ? "No students match this filter."
                        : "No students enrolled."}
                    </td>
                  </tr>
                ) : (
                  processedStudents.map((sr) => (
                    <tr key={sr.student_id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {sr.name}
                        {sr.isWeakStudent && (
                          <span className="ml-2 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                            Weak
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {sr.status === "Completed" ? `${sr.score} / ${sr.total}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {sr.status === "Completed" ? (
                          <span className="font-medium text-slate-900">{sr.percentage}%</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {sr.status === "Completed" ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              sr.passFail === "Pass"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                : "bg-red-50 text-red-700 ring-red-600/10"
                            }`}
                          >
                            Completed ({sr.passFail})
                          </span>
                        ) : sr.status === "In Progress" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                            Not Started
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openStudentDetail(sr.student_id)}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          View Result
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── INDIVIDUAL STUDENT MODAL / DRAWER ─── */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {studentDetail?.student?.name ?? "Student Performance"}
                </h3>
                <p className="text-sm text-slate-500">
                  {studentDetail?.assessment?.title}
                </p>
              </div>
              <button
                onClick={closeStudentDetail}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="py-6">
              {loadingStudent ? (
                <div className="py-8 text-center text-slate-500">Loading student details…</div>
              ) : !studentDetail ? (
                <div className="py-8 text-center text-red-600">Failed to load student details.</div>
              ) : studentDetail.status === "not_started" ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-slate-700">Assessment Not Started</p>
                  <p className="mt-1 text-sm text-slate-500">
                    This student has not started the assessment yet.
                  </p>
                </div>
              ) : studentDetail.status === "in_progress" ? (
                <div className="rounded-xl bg-amber-50 p-8 text-center border border-amber-200">
                  <p className="text-base font-semibold text-amber-800">Assessment In Progress</p>
                  <p className="mt-1 text-sm text-amber-700">
                    This student has started the assessment but has not submitted it yet.
                    Final score and concept performance are not available.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Score Card */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Overall Score</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {studentDetail.attempt?.score} / {studentDetail.attempt?.total}{" "}
                        <span className="text-lg font-normal text-slate-600">
                          ({studentDetail.attempt?.percentage}%)
                        </span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        studentDetail.attempt?.passFail === "Pass"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {studentDetail.attempt?.passFail}
                    </span>
                  </div>

                  {/* Concept Performance */}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                      Concept Performance
                    </h4>
                    <div className="mt-3 space-y-2">
                      {studentDetail.conceptPerformance?.map((cp) => (
                        <div
                          key={cp.concept}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                        >
                          <span className="font-medium text-slate-900">{cp.concept}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-700">
                              {cp.accuracyPercentage}%
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-bold ${
                                cp.level === "Strong"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : cp.level === "Medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {cp.level}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Learning Gaps */}
                  {studentDetail.gaps && studentDetail.gaps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-red-700">
                        Learning Gaps & AI Explanations
                      </h4>
                      <div className="mt-3 space-y-3">
                        {studentDetail.gaps.map((gap) => (
                          <div key={gap.concept} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                            <p className="font-bold text-red-900">{gap.concept}</p>
                            {gap.notes && <p className="mt-2 text-sm text-slate-700">{gap.notes}</p>}
                            {gap.recommendations && gap.recommendations.length > 0 && (
                              <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                                {gap.recommendations.map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 text-right">
              <button
                onClick={closeStudentDetail}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
