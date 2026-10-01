"use client";

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@/components/bolt/router';
import {
  FileText, Users, BarChart3, Target, Search,
  ChevronLeft, ChevronRight, MoreVertical, Eye,
  Download, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';

/* ─── Assessment type used on this page ──────────────────────── */
export interface ResultAssessment {
  id: string;
  title: string;
  description: string;
  displayClass: string;
  studentsCompleted: number;
  studentsTotal: number;
  avgScore: number;
  passRate: number;
  status: 'published' | 'draft';
  createdAt: string;
  color: 'teal' | 'blue' | 'amber' | 'purple' | 'rose' | 'emerald' | 'orange' | 'sky';
}

const ITEMS_PER_PAGE = 8;

/* ─── Color map for document icons ───────────────────────────── */
const iconColors: Record<ResultAssessment['color'], { bg: string; border: string; text: string }> = {
  teal:    { bg: 'bg-[#f0fdfa]', border: 'border-[#ccfbf1]', text: 'text-[#0d9488]' },
  blue:    { bg: 'bg-[#eff6ff]', border: 'border-[#dbeafe]', text: 'text-[#2563eb]' },
  amber:   { bg: 'bg-[#fffbeb]', border: 'border-[#fef3c7]', text: 'text-[#d97706]' },
  purple:  { bg: 'bg-[#faf5ff]', border: 'border-[#f3e8ff]', text: 'text-[#9333ea]' },
  rose:    { bg: 'bg-[#fff1f2]', border: 'border-[#ffe4e6]', text: 'text-[#e11d48]' },
  emerald: { bg: 'bg-[#ecfdf5]', border: 'border-[#d1fae5]', text: 'text-[#059669]' },
  orange:  { bg: 'bg-[#fff7ed]', border: 'border-[#ffedd5]', text: 'text-[#ea580c]' },
  sky:     { bg: 'bg-[#f0f9ff]', border: 'border-[#e0f2fe]', text: 'text-[#0284c7]' },
};

/* ─── Stat card colours ──────────────────────────────────────── */
const statCardStyles = [
  { bg: 'bg-[#eff6ff]', iconBg: 'bg-[#dbeafe]', iconText: 'text-[#2563eb]' },
  { bg: 'bg-[#f0fdfa]', iconBg: 'bg-[#ccfbf1]', iconText: 'text-[#0d9488]' },
  { bg: 'bg-[#fef2f2]', iconBg: 'bg-[#fecaca]', iconText: 'text-[#dc2626]' },
  { bg: 'bg-[#fef2f2]', iconBg: 'bg-[#fecaca]', iconText: 'text-[#dc2626]' },
];

export function TeacherResults() {
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [assessmentList, setAssessmentList] = useState<ResultAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'all' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterClass, setFilterClass] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('3months');

  useEffect(() => {
    setIsHydrated(true);
    let isCancelled = false;

    async function loadResults() {
      try {
        setLoading(true);
        const res = await fetch('/api/results/teacher');
        if (!res.ok) throw new Error('Failed to load assessment results');
        const data = await res.json();
        if (isCancelled) return;
        setAssessmentList(data.assessments || []);
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching teacher results:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      isCancelled = true;
    };
  }, []);

  /* Published assessments */
  const publishedAssessments = isHydrated
    ? assessmentList.filter((a) => a.status === 'published')
    : [];

  const filterDateCutoff = useMemo(() => {
    if (filterPeriod === 'alltime') return 0;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (filterPeriod === '3months') return now - 90 * dayMs;
    if (filterPeriod === '6months') return now - 180 * dayMs;
    if (filterPeriod === '1year') return now - 365 * dayMs;
    return 0;
  }, [filterPeriod]);

  /* Search & filter */
  const filteredAssessments = useMemo(() => {
    if (!isHydrated) return [];
    let list = publishedAssessments;
    if (filterClass !== 'all') {
      list = list.filter((a) => a.displayClass === filterClass);
    }
    if (filterDateCutoff > 0) {
      list = list.filter((a) => {
        const time = new Date(a.createdAt).getTime();
        return isNaN(time) || time >= filterDateCutoff;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [isHydrated, publishedAssessments, filterClass, filterDateCutoff, searchQuery]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filteredAssessments.length / ITEMS_PER_PAGE));
  const pagedAssessments = filteredAssessments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* Stats (always from all published, unfiltered) */
  const totalAssessments = isHydrated ? publishedAssessments.length : 0;
  const totalStudents = isHydrated
    ? publishedAssessments.reduce((s, a) => s + a.studentsTotal, 0)
    : 0;
  const avgScore =
    totalAssessments > 0
      ? Math.round(publishedAssessments.reduce((s, a) => s + a.avgScore, 0) / totalAssessments)
      : 0;
  const overallPassRate =
    totalAssessments > 0
      ? Math.round(publishedAssessments.reduce((s, a) => s + a.passRate, 0) / totalAssessments)
      : 0;

  /* Unique class names for filter dropdown */
  const classNames = isHydrated
    ? [...new Set(publishedAssessments.map((a) => a.displayClass))]
    : [];

  return (
    <div className="space-y-6 pb-10">
      {/* ──── Header row ──────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Results &amp; Analytics</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">
            View performance and identify learning gaps across your assessments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class filter */}
          <div className="relative">
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 pl-4 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] transition-all cursor-pointer"
            >
              <option value="all">All Classes</option>
              {classNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronRight className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          {/* Period filter */}
          <div className="relative">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="h-10 pl-4 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] transition-all cursor-pointer"
            >
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
              <option value="alltime">All Time</option>
            </select>
            <ChevronRight className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>

          {/* Create Assessment button */}
          <button
            type="button"
            onClick={() => navigate('/teacher/assessments/create')}
            className="h-10 px-5 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white font-medium text-sm shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="text-base leading-none">+</span>
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* ──── Stat cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {/* Total Assessments */}
        <div className={cn('rounded-2xl p-5 flex items-center gap-4', statCardStyles[0].bg)}>
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', statCardStyles[0].iconBg)}>
            <FileText className={cn('h-5 w-5', statCardStyles[0].iconText)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Assessments</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalAssessments}</p>
            <p className="text-xs text-slate-400 mt-0.5">{totalAssessments} published</p>
          </div>
        </div>

        {/* Total Students */}
        <div className={cn('rounded-2xl p-5 flex items-center gap-4', statCardStyles[1].bg)}>
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', statCardStyles[1].iconBg)}>
            <Users className={cn('h-5 w-5', statCardStyles[1].iconText)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Students</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalStudents}</p>
            <p className="text-xs text-slate-400 mt-0.5">Across all classes</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="rounded-2xl p-5 flex items-center gap-4 bg-[#fef2f2]">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-[#fee2e2]">
            <BarChart3 className="h-5 w-5 text-[#dc2626]" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Average Score</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-bold text-slate-900">{avgScore}%</p>
              <span className="flex items-center gap-0.5 text-xs font-medium text-[#16a34a]">
                <TrendingUp className="h-3 w-3" /> 6%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">vs. previous period</p>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="rounded-2xl p-5 flex items-center gap-4 bg-[#fef2f2]">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-[#fee2e2]">
            <Target className="h-5 w-5 text-[#dc2626]" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pass Rate</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-bold text-slate-900">{overallPassRate}%</p>
              <span className="flex items-center gap-0.5 text-xs font-medium text-[#16a34a]">
                <TrendingUp className="h-3 w-3" /> 8%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">vs. previous period</p>
          </div>
        </div>
      </div>

      {/* ──── Tabs + search ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Pill tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
              activeTab === 'all'
                ? 'bg-[#e6f7f5] text-[#0d9488] font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <span>All Assessments</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                activeTab === 'all' ? 'bg-[#0d9488] text-white' : 'bg-slate-200 text-slate-600'
              )}
            >
              {publishedAssessments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('published');
              setCurrentPage(1);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
              activeTab === 'published'
                ? 'bg-[#e6f7f5] text-[#0d9488] font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <span>Published</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                activeTab === 'published' ? 'bg-[#0d9488] text-white' : 'bg-slate-200 text-slate-600'
              )}
            >
              {publishedAssessments.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] transition-all"
          />
        </div>
      </div>

      {/* ──── Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-400 select-none">
                <th className="py-4 pl-6 pr-4 w-[30%]">Assessment</th>
                <th className="py-4 px-4 w-[10%]">Class</th>
                <th className="py-4 px-4 w-[10%]">Students</th>
                <th className="py-4 px-4 w-[11%]">Average Score</th>
                <th className="py-4 px-4 w-[9%]">Pass Rate</th>
                <th className="py-4 px-4 w-[9%]">Status</th>
                <th className="py-4 px-4 w-[11%]">
                  <div className="flex items-center gap-1">
                    Created <ArrowUpRight className="h-3 w-3 text-slate-300" />
                  </div>
                </th>
                <th className="py-4 pr-6 pl-2 w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {!isHydrated || loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                      <span>Loading assessment results...</span>
                    </div>
                  </td>
                </tr>
              ) : pagedAssessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    No assessments match your search.
                  </td>
                </tr>
              ) : (
                pagedAssessments.map((a) => {
                  const style = iconColors[a.color];
                  return (
                    <tr key={a.id} className="group hover:bg-slate-50/60 transition-colors">
                      {/* Assessment name + description */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs',
                              style.bg,
                              style.border,
                              style.text
                            )}
                          >
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                              className="text-left font-bold text-slate-900 hover:text-[#0d9488] transition-colors line-clamp-1 cursor-pointer"
                            >
                              {a.title}
                            </button>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 font-normal">
                              {a.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">
                          {a.displayClass}
                        </span>
                      </td>

                      {/* Students */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {a.studentsCompleted} / {a.studentsTotal}
                      </td>

                      {/* Average Score */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{a.avgScore}%</span>
                      </td>

                      {/* Pass Rate */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-700">{a.passRate}%</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]/60 flex items-center gap-1.5 w-fit">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                          Published
                        </span>
                      </td>

                      {/* Created */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500 font-normal">
                        {a.createdAt}
                      </td>

                      {/* Actions */}
                      <td className="py-4 pr-6 pl-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                            className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                          >
                            View Results
                          </button>
                          <Dropdown
                            trigger={
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                aria-label="More actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            }
                          >
                            <DropdownItem
                              icon={<Eye className="h-4 w-4" />}
                              onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                            >
                              View Details
                            </DropdownItem>
                            <DropdownItem
                              icon={<Download className="h-4 w-4" />}
                              onClick={() => window.open(`/api/results/teacher/${a.id}/export`, '_blank')}
                            >
                              Export Results
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──── Pagination ───────────────────────────────────────── */}
      {filteredAssessments.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAssessments.length)} of{' '}
            {filteredAssessments.length} assessments
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 w-9 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors cursor-pointer',
                  page === currentPage
                    ? 'bg-[#0d9488] text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 w-9 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
