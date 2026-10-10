"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  AlertTriangle,
  Target,
  Users,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Calendar,
  BookOpen,
  ArrowLeft,
  Sparkles,
  TrendingDown,
  Clock,
  Search,
  Filter,
  ArrowUpDown,
  X,
  FileCheck2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentItem {
  id: string;
  title: string;
  topic: string | null;
  className: string;
  subject: string | null;
  studentsTotal: number;
  studentsCompleted: number;
  hasInsights: boolean;
  insightsCount?: number;
  insightsGeneratedAt: string | null;
  createdAt: string;
}

interface SummaryData {
  completedAssessments: number;
  generatedInsights: number;
  conceptsNeedingAttention: number | null;
  studentsNeedingSupport: number | null;
}

interface AIInsightItem {
  concept: string;
  priority: "high" | "medium" | "low";
  weakStudentCount: number;
  action: string;
  focusStudents: string[];
}

interface InsightsData {
  insights: AIInsightItem[];
  generatedAt: string;
}

type ViewState =
  | { type: "list" }
  | { type: "generating"; assessment: AssessmentItem }
  | { type: "insights"; assessment: AssessmentItem; data: InsightsData; cached: boolean };

type StatusFilter = "all" | "ready" | "pending";
type SortOption = "newest" | "oldest" | "submissions" | "title";

// ─── Priority Config ──────────────────────────────────────────────────────────

const priorityConfig = {
  high: {
    label: "High Priority",
    badgeBg: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    leftBorder: "border-l-red-500",
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
  },
  medium: {
    label: "Medium Priority",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    leftBorder: "border-l-amber-500",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  low: {
    label: "Low Priority",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    leftBorder: "border-l-emerald-500",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatDate(dateStr);
  } catch {
    return "";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: AIInsightItem; index: number }) {
  const pc = priorityConfig[insight.priority];
  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl border border-l-4 shadow-2xs overflow-hidden",
        "transition-all duration-200 hover:shadow-xs",
        pc.leftBorder,
        "border-slate-200/90"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0", pc.iconBg)}>
              <TrendingDown className={cn("h-4 w-4", pc.iconColor)} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
                {insight.concept}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {insight.weakStudentCount} student{insight.weakStudentCount !== 1 ? "s" : ""} need support
              </p>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border flex-shrink-0",
              pc.badgeBg
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", pc.dot)} />
            {pc.label}
          </span>
        </div>

        {/* Action recommendation */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-3.5 w-3.5 text-[#0d9488]" />
            <span className="text-2xs font-bold uppercase tracking-wider text-[#0d9488]">
              Recommended Action
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{insight.action}</p>
        </div>

        {/* Focus students */}
        {insight.focusStudents.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                Focus Students ({insight.focusStudents.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {insight.focusStudents.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratingState({ assessmentTitle }: { assessmentTitle: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    "Loading student responses...",
    "Evaluating concept accuracy...",
    "Detecting learning gaps...",
    "Formulating targeted recommendations...",
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-[#0d9488] flex items-center justify-center shadow-xs">
          <Brain className="h-8 w-8 animate-pulse text-[#0d9488]" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-900 mb-1">Generating Insights</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        Analyzing responses for <span className="font-semibold text-slate-800">"{assessmentTitle}"</span>
      </p>

      <div className="w-full max-w-xs space-y-2 text-left">
        {steps.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all duration-300",
              i < step
                ? "bg-teal-50/80 text-teal-800 font-medium"
                : i === step
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "text-slate-400"
            )}
          >
            {i < step ? (
              <CheckCircle2 className="h-4 w-4 text-[#0d9488] flex-shrink-0" />
            ) : i === step ? (
              <div className="h-4 w-4 rounded-full border-2 border-[#0d9488] border-t-transparent animate-spin flex-shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-slate-300 flex-shrink-0" />
            )}
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeacherInsights() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>({ type: "list" });
  const [error, setError] = useState<string | null>(null);
  const [generatingError, setGeneratingError] = useState<string | null>(null);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/insights/teacher");
      if (!res.ok) throw new Error("Failed to load assessments");
      const data = await res.json();
      setAssessments(data.assessments ?? []);
      if (data.summary) {
        setSummary(data.summary);
      } else {
        // Fallback calculation if summary omitted
        const list: AssessmentItem[] = data.assessments ?? [];
        setSummary({
          completedAssessments: list.length,
          generatedInsights: list.filter((a) => a.hasInsights).length,
          conceptsNeedingAttention: null,
          studentsNeedingSupport: null,
        });
      }
    } catch {
      setError("Could not load assessments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const handleGenerateInsights = useCallback(async (assessment: AssessmentItem) => {
    setGeneratingError(null);

    // Check for cached insights first
    const cacheRes = await fetch(
      `/api/insights/teacher/generate?assessmentId=${assessment.id}`
    );
    const cacheData = cacheRes.ok ? await cacheRes.json() : null;

    if (cacheData?.cached && cacheData?.insights) {
      setView({
        type: "insights",
        assessment,
        data: cacheData.insights,
        cached: true,
      });
      return;
    }

    // No cache — show generating state and call POST
    setView({ type: "generating", assessment });

    try {
      const genRes = await fetch("/api/insights/teacher/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id }),
      });

      if (!genRes.ok) {
        const errData = await genRes.json().catch(() => ({}));
        const msg = errData?.error?.message || "Failed to generate insights.";
        setGeneratingError(msg);
        setView({ type: "list" });
        return;
      }

      const genData = await genRes.json();

      // Update local assessment
      setAssessments((prev) =>
        prev.map((a) =>
          a.id === assessment.id
            ? {
                ...a,
                hasInsights: true,
                insightsCount: genData.insights?.insights?.length ?? 0,
                insightsGeneratedAt: genData.generatedAt,
              }
            : a
        )
      );

      setSummary((prev) =>
        prev
          ? {
              ...prev,
              generatedInsights: prev.generatedInsights + (assessment.hasInsights ? 0 : 1),
            }
          : null
      );

      setView({
        type: "insights",
        assessment: { ...assessment, hasInsights: true, insightsGeneratedAt: genData.generatedAt },
        data: genData.insights,
        cached: false,
      });
    } catch {
      setGeneratingError("Something went wrong. Please try again.");
      setView({ type: "list" });
    }
  }, []);

  const handleRegenerate = useCallback(async (assessment: AssessmentItem) => {
    setGeneratingError(null);
    setView({ type: "generating", assessment });

    try {
      const genRes = await fetch("/api/insights/teacher/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id }),
      });

      if (!genRes.ok) {
        const errData = await genRes.json().catch(() => ({}));
        setGeneratingError(errData?.error?.message || "Failed to regenerate insights.");
        setView({ type: "list" });
        return;
      }

      const genData = await genRes.json();
      setView({
        type: "insights",
        assessment,
        data: genData.insights,
        cached: false,
      });
    } catch {
      setGeneratingError("Something went wrong. Please try again.");
      setView({ type: "list" });
    }
  }, []);

  // Filtered and sorted assessments
  const filteredAssessments = useMemo(() => {
    let list = [...assessments];

    // Status filter
    if (statusFilter === "ready") {
      list = list.filter((a) => a.hasInsights);
    } else if (statusFilter === "pending") {
      list = list.filter((a) => !a.hasInsights);
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.className.toLowerCase().includes(q) ||
          (a.subject ? a.subject.toLowerCase().includes(q) : false) ||
          (a.topic ? a.topic.toLowerCase().includes(q) : false)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "submissions") {
        return b.studentsCompleted - a.studentsCompleted;
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return list;
  }, [assessments, statusFilter, searchQuery, sortBy]);

  const readyCount = useMemo(() => assessments.filter((a) => a.hasInsights).length, [assessments]);
  const pendingCount = useMemo(() => assessments.filter((a) => !a.hasInsights).length, [assessments]);

  // ── RENDER: Insights Detailed View ──────────────────────────────────────────

  if (view.type === "insights") {
    const { assessment, data, cached } = view;
    const highInsights = data.insights.filter((i) => i.priority === "high");
    const mediumInsights = data.insights.filter((i) => i.priority === "medium");
    const lowInsights = data.insights.filter((i) => i.priority === "low");

    return (
      <div className="space-y-6 pb-12">
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView({ type: "list" })}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Assessments</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {assessment.title}
                </h1>
                {cached && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 text-slate-600">
                    <Clock className="h-3 w-3" />
                    Cached · {formatRelative(assessment.insightsGeneratedAt)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {assessment.className}
                {assessment.subject ? ` · ${assessment.subject}` : ""}
                {" · "}
                {assessment.studentsCompleted} student{assessment.studentsCompleted !== 1 ? "s" : ""} completed
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRegenerate(assessment)}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Regenerate</span>
          </button>
        </div>

        {/* High-Clarity Gap Summary Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 text-[#0d9488] flex items-center justify-center flex-shrink-0">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {data.insights.length === 0
                  ? "All concepts mastered"
                  : `${data.insights.length} concept gap${data.insights.length !== 1 ? "s" : ""} identified`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.insights.length === 0
                  ? "No significant learning gaps detected for this assessment."
                  : "Target high and medium priority areas in upcoming lessons."}
              </p>
            </div>
          </div>

          {/* Priority breakdown chips */}
          {data.insights.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200/70 text-xs font-semibold text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{highInsights.length} High</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-xs font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>{mediumInsights.length} Medium</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{lowInsights.length} Low</span>
              </div>
            </div>
          )}
        </div>

        {/* Empty state when 0 gaps found */}
        {data.insights.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Learning Gaps Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Students demonstrated strong mastery across all evaluated concepts in this assessment.
            </p>
          </div>
        )}

        {/* Grouped insight cards */}
        {highInsights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                High Priority ({highInsights.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {highInsights.map((insight, i) => (
                <InsightCard key={`high-${i}`} insight={insight} index={i} />
              ))}
            </div>
          </div>
        )}

        {mediumInsights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Medium Priority ({mediumInsights.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mediumInsights.map((insight, i) => (
                <InsightCard key={`med-${i}`} insight={insight} index={i} />
              ))}
            </div>
          </div>
        )}

        {lowInsights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Low Priority ({lowInsights.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {lowInsights.map((insight, i) => (
                <InsightCard key={`low-${i}`} insight={insight} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RENDER: Generating Loading State ────────────────────────────────────────

  if (view.type === "generating") {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#0d9488] flex items-center justify-center flex-shrink-0">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Insights</h1>
            <p className="text-xs text-slate-500">Analyzing assessment performance</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <GeneratingState assessmentTitle={view.assessment.title} />
        </div>
      </div>
    );
  }

  // ── RENDER: Assessment Dashboard List ───────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">
      {/* ── Compact Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#0d9488] flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Teaching Insights
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              AI-powered learning gap analysis and recommendations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadAssessments()}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Responsive Summary Metrics Section ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Completed Assessments */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#0d9488] flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Completed Assessments
            </p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? "—" : summary?.completedAssessments ?? assessments.length}
            </p>
          </div>
        </div>

        {/* Metric 2: Insights Generated */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Insights Generated
            </p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? "—" : summary?.generatedInsights ?? readyCount}
            </p>
          </div>
        </div>

        {/* Metric 3: Concepts Needing Attention */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Concepts to Reinforce
            </p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {loading
                ? "—"
                : summary?.conceptsNeedingAttention !== null && summary?.conceptsNeedingAttention !== undefined
                ? summary.conceptsNeedingAttention
                : "—"}
            </p>
          </div>
        </div>

        {/* Metric 4: Students Needing Support */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Students Needing Support
            </p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {loading
                ? "—"
                : summary?.studentsNeedingSupport !== null && summary?.studentsNeedingSupport !== undefined
                ? summary.studentsNeedingSupport
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Error Notification ──────────────────────────────────────────── */}
      {(error || generatingError) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="font-medium flex-1">{error || generatingError}</p>
          <button
            type="button"
            onClick={() => { setError(null); setGeneratingError(null); }}
            className="text-red-400 hover:text-red-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Toolbar: Search, Filter Tabs & Sort ──────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto self-start md:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            All ({assessments.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ready")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "ready"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Insights Ready ({readyCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "pending"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Not Analyzed ({pendingCount})
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md self-stretch md:self-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search assessments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:border-[#0d9488] cursor-pointer shadow-2xs"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="submissions">Most Submissions</option>
              <option value="title">A–Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
      {(!isHydrated || loading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-2xs space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 bg-slate-100 rounded-md" />
                <div className="h-4 w-16 bg-slate-100 rounded-md" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-slate-100 rounded-md" />
                <div className="h-3.5 w-1/2 bg-slate-100 rounded-md" />
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full" />
              <div className="h-9 w-full bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State: No Completed Assessments ────────────────────────── */}
      {isHydrated && !loading && assessments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Completed Assessments</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once students submit responses for published assessments, they will appear here ready for AI learning gap analysis.
          </p>
        </div>
      )}

      {/* ── Empty State: Search/Filter Match 0 ───────────────────────────── */}
      {isHydrated && !loading && assessments.length > 0 && filteredAssessments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">No Matching Assessments</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
            Try adjusting your search query or filter selection.
          </p>
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ── Redesigned Assessment Cards Grid ─────────────────────────────── */}
      {isHydrated && !loading && filteredAssessments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssessments.map((assessment, idx) => {
            const completionPct =
              assessment.studentsTotal > 0
                ? Math.round((assessment.studentsCompleted / assessment.studentsTotal) * 100)
                : 0;

            return (
              <div
                key={assessment.id}
                className={cn(
                  "group bg-white rounded-2xl border shadow-2xs hover:shadow-xs transition-all duration-200 p-5 flex flex-col justify-between",
                  assessment.hasInsights
                    ? "border-indigo-100 hover:border-indigo-300"
                    : "border-slate-200/90 hover:border-slate-300"
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div>
                  {/* Card top badge row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {assessment.hasInsights ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-200/70 text-indigo-700">
                        <Sparkles className="h-3 w-3 text-indigo-500" />
                        Insights Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-semibold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        Not Analyzed
                      </span>
                    )}

                    <span className="text-2xs text-slate-400 font-medium">
                      {formatDate(assessment.createdAt)}
                    </span>
                  </div>

                  {/* Title & Topic */}
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-[#0d9488] transition-colors line-clamp-2">
                      {assessment.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {assessment.className}
                      </span>
                      {assessment.subject && (
                        <span className="text-xs text-slate-500 font-medium">
                          · {assessment.subject}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress & Submissions */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        {assessment.studentsCompleted} / {assessment.studentsTotal} submissions
                      </span>
                      <span className="text-slate-700 font-semibold">{completionPct}%</span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          assessment.hasInsights ? "bg-indigo-500" : "bg-[#0d9488]"
                        )}
                        style={{ width: `${Math.min(100, completionPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="mb-5">
                    {assessment.hasInsights ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                        <span>
                          {assessment.insightsCount && assessment.insightsCount > 0
                            ? `${assessment.insightsCount} gap${assessment.insightsCount !== 1 ? "s" : ""} found · Generated ${formatRelative(assessment.insightsGeneratedAt)}`
                            : `Ready · Generated ${formatRelative(assessment.insightsGeneratedAt)}`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <Brain className="h-3.5 w-3.5 text-slate-400" />
                        <span>Awaiting AI analysis</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateInsights(assessment)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 h-9.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs",
                    assessment.hasInsights
                      ? "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
                      : "bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{assessment.hasInsights ? "View Insights" : "Generate Insights"}</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
