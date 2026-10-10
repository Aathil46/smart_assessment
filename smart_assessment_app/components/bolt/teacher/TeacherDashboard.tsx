"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "@/components/bolt/router";
import { cn } from "@/lib/utils";
import type { TeacherDashboardData, DashboardTrendPoint, DashboardNotification } from "@/app/api/teacher/dashboard/route";
import {
  BookOpen, Users, ClipboardCheck, AlertTriangle, TrendingUp, TrendingDown,
  Minus, ArrowRight, RefreshCw, Bell, Trophy, Sparkles, Plus,
  CheckCircle2, Target, BarChart2, Calendar, ChevronRight, ChevronDown, Award,
  Clock, ShieldCheck, HelpCircle, Layers,
} from "lucide-react";

// ─── Count-Up Hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration: number = 700): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setCount(target);
      return;
    }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || target === 0) {
      setCount(target);
      return;
    }

    let start = 0;
    const startTime = performance.now();

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (target - start) * ease);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    const handle = requestAnimationFrame(update);
    return () => cancelAnimationFrame(handle);
  }, [target, duration]);

  return count;
}

// ─── Summary Card Component ───────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: number;
  unit?: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "teal" | "blue" | "purple" | "amber";
  isPulse?: boolean;
  delayMs?: number;
}

const accentStyles = {
  teal: {
    border: "border-teal-200/80 hover:border-teal-400",
    topBar: "bg-gradient-to-r from-teal-500 to-emerald-400",
    bgWash: "bg-gradient-to-br from-teal-50/40 via-white to-white",
    iconBg: "bg-teal-50 text-teal-600 border border-teal-100/80",
    valueText: "text-slate-900",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    shadow: "hover:shadow-teal-500/10",
  },
  blue: {
    border: "border-blue-200/80 hover:border-blue-400",
    topBar: "bg-gradient-to-r from-blue-500 to-indigo-400",
    bgWash: "bg-gradient-to-br from-blue-50/40 via-white to-white",
    iconBg: "bg-blue-50 text-blue-600 border border-blue-100/80",
    valueText: "text-slate-900",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    shadow: "hover:shadow-blue-500/10",
  },
  purple: {
    border: "border-purple-200/80 hover:border-purple-400",
    topBar: "bg-gradient-to-r from-purple-500 to-violet-400",
    bgWash: "bg-gradient-to-br from-purple-50/40 via-white to-white",
    iconBg: "bg-purple-50 text-purple-600 border border-purple-100/80",
    valueText: "text-slate-900",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    shadow: "hover:shadow-purple-500/10",
  },
  amber: {
    border: "border-amber-200/80 hover:border-amber-400",
    topBar: "bg-gradient-to-r from-amber-500 to-orange-400",
    bgWash: "bg-gradient-to-br from-amber-50/40 via-white to-white",
    iconBg: "bg-amber-50 text-amber-600 border border-amber-100/80",
    valueText: "text-slate-900",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    shadow: "hover:shadow-amber-500/10",
  },
};

function SummaryCard({ title, value, unit, subtitle, icon, accent, isPulse = false, delayMs = 0 }: SummaryCardProps) {
  const animatedValue = useCountUp(value, 750);
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-white p-5 shadow-sm overflow-hidden",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md",
        styles.border,
        styles.bgWash,
        styles.shadow
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Accent top line */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", styles.topBar)} />

      <div className="flex items-start justify-between mb-3.5 pt-0.5">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105", styles.iconBg)}>
          {icon}
        </div>
        {isPulse && value > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Attention
          </span>
        )}
      </div>

      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>

      <div className="flex items-baseline gap-1">
        <span className={cn("text-3xl font-extrabold tracking-tight tabular-nums", styles.valueText)}>
          {animatedValue}
        </span>
        {unit && <span className="text-lg font-semibold text-slate-500">{unit}</span>}
      </div>

      <p className="text-2xs font-medium text-slate-400 mt-1.5 truncate">{subtitle}</p>
    </div>
  );
}

// ─── Interactive SVG Performance Chart ────────────────────────────────────────

// ─── Interactive SVG Performance Chart ────────────────────────────────────────

export interface AggregatedTrendPoint {
  key: string;
  label: string;
  periodLabel: string;
  avgScore: number;
  submissionsCount: number;
  assessmentsCount: number;
  className: string;
}

interface PerformanceChartProps {
  data: AggregatedTrendPoint[];
  trend: "improving" | "declining" | "stable";
  deltaPct: number;
  overallAvg: number;
  timeframe: "weekly" | "monthly";
  selectedClassName: string;
}

function PerformanceChart({
  data,
  trend,
  deltaPct,
  overallAvg,
  timeframe,
  selectedClassName,
}: PerformanceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px] rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
        <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3">
          <BarChart2 className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 mb-1">
          No Assessment Data
        </h4>
        <p className="text-xs text-slate-500 max-w-sm">
          No completed assessments with submissions found for {selectedClassName}. Complete assessments to view performance trends over time.
        </p>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px] rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
        <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3">
          <BarChart2 className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 mb-1">
          1 {timeframe === "weekly" ? "Week" : "Month"} Recorded
        </h4>
        <p className="text-xs text-slate-500 max-w-sm">
          Initial average score: <strong className="text-teal-700 font-bold">{data[0].avgScore}%</strong> for {data[0].periodLabel} ({data[0].submissionsCount} submissions). Complete assessments across additional {timeframe === "weekly" ? "weeks" : "months"} to view trajectory and trends over time.
        </p>
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const minVal = 0;
  const maxVal = 100;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.avgScore - minVal) / (maxVal - minVal)) * chartHeight;
    return { ...d, x, y };
  });

  // Smooth SVG path
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartHeight} L ${points[0].x.toFixed(1)} ${padding.top + chartHeight} Z`;

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  // Decide if X label should display to avoid crowding on mobile
  const totalPoints = points.length;
  const skipFactor = totalPoints > 10 ? 3 : totalPoints > 6 ? 2 : 1;
  const shouldShowLabel = (index: number) => {
    if (index === 0 || index === totalPoints - 1) return true;
    return index % skipFactor === 0;
  };

  return (
    <div
      className="relative w-full select-none"
      onTouchStart={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ minHeight: "200px" }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#0d9488" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.00" />
          </linearGradient>
          <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0d9488" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding.top + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray={val === 50 ? "3 3" : undefined}
              />
              <text
                x={padding.left - 10}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-2xs font-medium"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Gradient fill area */}
        <path d={areaD} fill="url(#chartGradient)" />

        {/* Main line */}
        <path
          d={pathD}
          fill="none"
          stroke="#0d9488"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#shadowFilter)"
        />

        {/* Active hover vertical indicator line */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padding.top}
            x2={activePoint.x}
            y2={padding.top + chartHeight}
            stroke="#0d9488"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="transition-all duration-150"
          />
        )}

        {/* Data points & X-axis labels */}
        {points.map((p, i) => {
          const isHovered = hoverIndex === i;
          const showLabel = shouldShowLabel(i);

          return (
            <g
              key={p.key || i}
              className="cursor-pointer group"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={(e) => {
                e.stopPropagation();
                setHoverIndex(hoverIndex === i ? null : i);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setHoverIndex(i);
              }}
            >
              {/* Invisible larger hit target for touch and mouse */}
              <circle cx={p.x} cy={p.y} r="18" fill="transparent" />

              {/* Outer halo on hover */}
              {isHovered && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="8"
                  fill="#ccfbf1"
                  stroke="#0d9488"
                  strokeWidth="1.5"
                  className="animate-pulse"
                />
              )}

              {/* Point dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? "5" : "3.5"}
                fill="#ffffff"
                stroke="#0d9488"
                strokeWidth={isHovered ? "3" : "2"}
                className="transition-all duration-150"
              />

              {/* X-axis date label */}
              {showLabel && (
                <text
                  x={p.x}
                  y={svgHeight - padding.bottom + 18}
                  textAnchor="middle"
                  className={cn(
                    "text-2xs font-medium transition-colors",
                    isHovered ? "fill-slate-900 font-bold" : "fill-slate-500"
                  )}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating rich tooltip on hover / touch */}
      {activePoint && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl bg-slate-900 text-white p-3 shadow-xl border border-slate-700/80 transition-all duration-150"
          style={{
            left: `${Math.min(Math.max((activePoint.x / svgWidth) * 100, 10), 90)}%`,
            top: `${Math.min(Math.max((activePoint.y / svgHeight) * 100, 10), 90)}%`,
            transform:
              activePoint.y < 70
                ? activePoint.x < 150
                  ? "translate(0, 15px)"
                  : activePoint.x > svgWidth - 150
                  ? "translate(-100%, 15px)"
                  : "translate(-50%, 15px)"
                : activePoint.x < 150
                ? "translate(0, -115%)"
                : activePoint.x > svgWidth - 150
                ? "translate(-100%, -115%)"
                : "translate(-50%, -115%)",
            minWidth: "160px",
            maxWidth: "260px",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-2xs text-teal-300 font-semibold uppercase tracking-wider truncate max-w-[120px]">
              {activePoint.className}
            </span>
            <span className="text-2xs text-slate-400 whitespace-nowrap">
              {timeframe === "weekly" ? "Weekly Avg" : "Monthly Avg"}
            </span>
          </div>
          <p className="text-xs font-bold text-white truncate mb-2">{activePoint.periodLabel}</p>
          <div className="flex items-baseline justify-between pt-1 border-t border-slate-800">
            <span className="text-2xs text-slate-400">Average Score</span>
            <span className="text-base font-extrabold text-teal-400 tabular-nums">{activePoint.avgScore}%</span>
          </div>
          <div className="flex items-center justify-between text-2xs text-slate-400 mt-0.5">
            <span>Assessments</span>
            <span className="font-semibold text-slate-200">{activePoint.assessmentsCount}</span>
          </div>
          <div className="flex items-center justify-between text-2xs text-slate-400 mt-0.5">
            <span>Submissions</span>
            <span className="font-semibold text-slate-200">{activePoint.submissionsCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Teacher Dashboard Component ─────────────────────────────────────────

interface TeacherDashboardProps {
  initialTeacherName?: string;
}

export function TeacherDashboard({ initialTeacherName }: TeacherDashboardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const response = await fetch("/api/teacher/dashboard");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error?.message || "Failed to load dashboard data.");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly">("weekly");

  // Default to first assigned class or "all"
  useEffect(() => {
    if (data?.classes && data.classes.length > 0 && selectedClassId === "") {
      setSelectedClassId(data.classes[0].id);
    } else if (data && (!data.classes || data.classes.length === 0) && selectedClassId === "") {
      setSelectedClassId("all");
    }
  }, [data, selectedClassId]);

  // Filter raw completed assessment trend points by selected class
  const filteredPoints = useMemo(() => {
    if (!data?.performanceTrend?.data) return [];
    if (!selectedClassId || selectedClassId === "all") {
      return data.performanceTrend.data;
    }
    return data.performanceTrend.data.filter((p) => p.classId === selectedClassId);
  }, [data?.performanceTrend?.data, selectedClassId]);

  // Aggregate points by calendar week or calendar month
  const aggregatedPoints = useMemo<AggregatedTrendPoint[]>(() => {
    if (filteredPoints.length === 0) return [];

    const groups = new Map<
      string,
      {
        key: string;
        sortTime: number;
        label: string;
        periodLabel: string;
        totalWeightedScore: number;
        totalSubmissions: number;
        assessmentsCount: number;
        totalScoreSum: number;
      }
    >();

    for (const p of filteredPoints) {
      const d = new Date(p.fullDate || p.date);
      if (isNaN(d.getTime())) continue;

      let groupKey: string;
      let sortTime: number;
      let label: string;
      let periodLabel: string;

      if (timeframe === "weekly") {
        const day = d.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

        groupKey = `${monday.getFullYear()}-W${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
        sortTime = monday.getTime();

        const startStr = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const endStr = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        label = startStr;
        periodLabel = `Week of ${startStr} – ${endStr}`;
      } else {
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        groupKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        sortTime = monthStart.getTime();

        label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        periodLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          sortTime,
          label,
          periodLabel,
          totalWeightedScore: 0,
          totalSubmissions: 0,
          assessmentsCount: 0,
          totalScoreSum: 0,
        });
      }

      const g = groups.get(groupKey)!;
      const subs = p.submissionsCount > 0 ? p.submissionsCount : 1;
      g.totalWeightedScore += p.avgScore * subs;
      g.totalSubmissions += subs;
      g.totalScoreSum += p.avgScore;
      g.assessmentsCount += 1;
    }

    const sorted = Array.from(groups.values()).sort((a, b) => a.sortTime - b.sortTime);

    const selectedClass = data?.classes.find((c) => c.id === selectedClassId);
    const activeClassName = selectedClass ? selectedClass.name : "All Classes";

    return sorted.map((g) => {
      const avgScore =
        g.totalSubmissions > 0
          ? Math.round(g.totalWeightedScore / g.totalSubmissions)
          : Math.round(g.totalScoreSum / Math.max(g.assessmentsCount, 1));

      return {
        key: g.key,
        label: g.label,
        periodLabel: g.periodLabel,
        avgScore,
        submissionsCount: g.totalSubmissions,
        assessmentsCount: g.assessmentsCount,
        className: activeClassName,
      };
    });
  }, [filteredPoints, timeframe, data?.classes, selectedClassId]);

  // Aggregate trend metrics
  const { trend, deltaPct, overallAvg } = useMemo(() => {
    if (aggregatedPoints.length === 0) {
      return { trend: "stable" as const, deltaPct: 0, overallAvg: 0 };
    }

    let totalWeighted = 0;
    let totalSubs = 0;
    for (const pt of aggregatedPoints) {
      totalWeighted += pt.avgScore * pt.submissionsCount;
      totalSubs += pt.submissionsCount;
    }
    const overallAvg =
      totalSubs > 0
        ? Math.round(totalWeighted / totalSubs)
        : Math.round(aggregatedPoints.reduce((acc, p) => acc + p.avgScore, 0) / aggregatedPoints.length);

    if (aggregatedPoints.length < 2) {
      return { trend: "stable" as const, deltaPct: 0, overallAvg };
    }

    const last = aggregatedPoints[aggregatedPoints.length - 1].avgScore;
    const prev = aggregatedPoints[aggregatedPoints.length - 2].avgScore;
    const deltaPct = last - prev;
    const trend = deltaPct > 1 ? ("improving" as const) : deltaPct < -1 ? ("declining" as const) : ("stable" as const);

    return { trend, deltaPct, overallAvg };
  }, [aggregatedPoints]);

  const teacherFirstName = (data?.teacher.name || initialTeacherName || "Teacher").split(" ")[0];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ─── Header Section ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {teacherFirstName}
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              Teacher Portal
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time overview of your classes, student outcomes, and learning weaknesses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing || loading}
            aria-label="Refresh dashboard"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold",
              "bg-white border border-slate-200 text-slate-700 shadow-sm",
              "hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", refreshing && "animate-spin text-teal-600")} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={() => navigate("/teacher/assessments")}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold",
              "bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20",
              "transition-all active:scale-[0.98]"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* ─── Error Notification ───────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="text-xs font-bold underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Loading Skeleton ─────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60" />
            <div className="h-72 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60" />
          </div>
          <div className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60" />
        </div>
      ) : (
        <>
          {/* ─── 1. TOP SUMMARY CARDS ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Classes"
              value={data?.summary.totalClasses ?? 0}
              subtitle="Active teaching classes"
              icon={<BookOpen className="h-5 w-5" />}
              accent="teal"
              delayMs={0}
            />

            <SummaryCard
              title="Total Students"
              value={data?.summary.totalStudents ?? 0}
              subtitle="Enrolled learners"
              icon={<Users className="h-5 w-5" />}
              accent="blue"
              delayMs={60}
            />

            <SummaryCard
              title="Assessments Conducted"
              value={data?.summary.assessmentsConducted ?? 0}
              subtitle="Evaluated & conducted"
              icon={<ClipboardCheck className="h-5 w-5" />}
              accent="purple"
              delayMs={120}
            />

            <SummaryCard
              title="Weak Concepts Rate"
              value={data?.summary.weakConceptsRate ?? 0}
              unit="%"
              subtitle="Requires instructional review"
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="amber"
              isPulse={(data?.summary.weakConceptsRate ?? 0) > 0}
              delayMs={180}
            />
          </div>

          {/* ─── 2. PERFORMANCE TREND ROW ─────────────────── */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">Performance Over Time</h2>
                  {overallAvg > 0 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      Avg: {overallAvg}%
                    </span>
                  ) : null}

                  {aggregatedPoints.length >= 2 && (
                    <div className="flex items-center gap-1.5">
                      {trend === "improving" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Improving ({deltaPct > 0 ? `+${deltaPct}%` : ""})
                        </span>
                      )}
                      {trend === "declining" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <TrendingDown className="h-3.5 w-3.5" />
                          Declining ({deltaPct}%)
                        </span>
                      )}
                      {trend === "stable" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Minus className="h-3.5 w-3.5" />
                          Stable
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {timeframe === "weekly" ? "Weekly" : "Monthly"} average score across completed assessments
                </p>
              </div>

              {/* Class & Weekly/Monthly Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                {/* Class Filter */}
                <div className="relative flex-1 sm:flex-initial">
                  <label htmlFor="dashboard-class-filter" className="sr-only">
                    Filter by Class
                  </label>
                  <select
                    id="dashboard-class-filter"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full sm:w-auto min-w-[150px] max-w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none cursor-pointer"
                  >
                    {data?.classes && data.classes.length > 1 && (
                      <option value="all">All Classes</option>
                    )}
                    {data?.classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {cls.grade ? `(${cls.grade})` : ""}
                      </option>
                    ))}
                    {(!data?.classes || data.classes.length === 0) && (
                      <option value="all">All Classes</option>
                    )}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Timeframe Filter (Weekly / Monthly) */}
                <div className="relative flex-1 sm:flex-initial">
                  <label htmlFor="dashboard-timeframe-filter" className="sr-only">
                    Filter by Timeframe
                  </label>
                  <select
                    id="dashboard-timeframe-filter"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as "weekly" | "monthly")}
                    className="w-full sm:w-auto min-w-[110px] h-9 pl-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <PerformanceChart
              data={aggregatedPoints}
              trend={trend}
              deltaPct={deltaPct}
              overallAvg={overallAvg}
              timeframe={timeframe}
              selectedClassName={
                selectedClassId === "all"
                  ? "All Classes"
                  : data?.classes.find((c) => c.id === selectedClassId)?.name || "Selected Class"
              }
            />
          </div>

          {/* ─── 3. MY CLASSES SECTION ─────────────────────────────────────── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">My Classes</h2>
                {data && data.classes.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {data.classes.length}
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate("/teacher/classes")}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 transition-colors"
              >
                <span>Manage Classes</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {data && data.classes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.classes.map((cls, idx) => {
                  const paletteColors = [
                    "from-teal-500 to-emerald-400",
                    "from-blue-500 to-indigo-400",
                    "from-purple-500 to-violet-400",
                    "from-amber-500 to-orange-400",
                  ];
                  const barGradient = paletteColors[idx % paletteColors.length];

                  return (
                    <div
                      key={cls.id}
                      onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                      className={cn(
                        "group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden cursor-pointer",
                        "transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300"
                      )}
                    >
                      {/* Top accent line */}
                      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", barGradient)} />

                      <div className="flex items-start justify-between mb-3 pt-0.5">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                            {cls.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {cls.subject || "General"} {cls.grade ? `· Grade ${cls.grade}` : ""}
                          </p>
                        </div>
                        {cls.avgPerformance !== null && (
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums",
                              cls.avgPerformance >= 75
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : cls.avgPerformance >= 50
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}
                          >
                            {cls.avgPerformance}% avg
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                        <div className="p-2.5 rounded-xl bg-slate-50/80 text-center">
                          <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums">{cls.studentCount}</p>
                          <p className="text-2xs font-medium text-slate-500 uppercase tracking-wider">Students</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50/80 text-center">
                          <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums">{cls.assessmentCount}</p>
                          <p className="text-2xs font-medium text-slate-500 uppercase tracking-wider">Assessments</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-2xs font-semibold text-slate-400 group-hover:text-teal-600 mt-3 pt-2 border-t border-slate-50 transition-colors">
                        <span>Code: {cls.code}</span>
                        <span className="inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          View Class <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
                <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">No Classes Yet</h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Create your first class to begin conducting assessments and tracking outcomes.
                </p>
                <button
                  onClick={() => navigate("/teacher/classes")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  Create Class
                </button>
              </div>
            )}
          </div>

          {/* ─── 4. TOP PERFORMERS ROW ─────────────────────────────────────── */}
          <div className="w-full">
            {/* ─── Top Performers ────────────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Top Performers</h2>
                      <p className="text-2xs text-slate-500">Highest-scoring students across assessments</p>
                    </div>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Real Results
                  </span>
                </div>

                {data && data.topPerformers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.topPerformers.map((student) => {
                      const isGold = student.rank === 1;
                      const isSilver = student.rank === 2;
                      const isBronze = student.rank === 3;

                      return (
                        <div
                          key={student.studentId}
                          className={cn(
                            "flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200",
                            "hover:shadow-sm hover:-translate-y-0.5",
                            isGold
                              ? "bg-gradient-to-r from-amber-50/50 via-white to-white border-amber-200"
                              : isSilver
                              ? "bg-slate-50/40 border-slate-200"
                              : isBronze
                              ? "bg-orange-50/30 border-orange-200/80"
                              : "bg-white border-slate-100"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Rank Badge */}
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs flex-shrink-0",
                                isGold
                                  ? "bg-amber-400 text-amber-950 shadow-sm shadow-amber-500/30 ring-2 ring-amber-300/40"
                                  : isSilver
                                  ? "bg-slate-200 text-slate-800"
                                  : isBronze
                                  ? "bg-amber-700/80 text-amber-50"
                                  : "bg-slate-100 text-slate-600 font-bold"
                              )}
                            >
                              {isGold ? <Sparkles className="h-4 w-4" /> : `#${student.rank}`}
                            </div>

                            {/* Avatar */}
                            {student.avatarUrl ? (
                              <img
                                src={student.avatarUrl}
                                alt={student.name}
                                className="h-9 w-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex-shrink-0">
                                {student.initials}
                              </div>
                            )}

                            {/* Info */}
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {student.name}
                              </p>
                              <p className="text-2xs text-slate-500 truncate mt-0.5">
                                {student.className} · {student.assessmentsCount} test{student.assessmentsCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>

                          {/* Score Pill */}
                          <div className="text-right flex-shrink-0 pl-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                              {student.avgScore}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <Trophy className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Assessment Results Yet</p>
                    <p className="text-2xs text-slate-400 mt-0.5 max-w-[220px]">
                      Student rankings appear automatically as assessments are conducted and scored.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 text-right">
                <button
                  onClick={() => navigate("/teacher/results")}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 transition-colors"
                >
                  <span>View All Student Results</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
