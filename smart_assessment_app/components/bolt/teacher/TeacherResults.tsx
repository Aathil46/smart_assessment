"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@/components/bolt/router';
import {
  FileText, Search, ChevronLeft, ChevronRight,
  MoreVertical, Eye, Download, ArrowUpRight,
  Calendar, Check, X,
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
  createdAtRaw?: string;
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

const MONTHS = [
  { num: '01', label: 'Jan' },
  { num: '02', label: 'Feb' },
  { num: '03', label: 'Mar' },
  { num: '04', label: 'Apr' },
  { num: '05', label: 'May' },
  { num: '06', label: 'Jun' },
  { num: '07', label: 'Jul' },
  { num: '08', label: 'Aug' },
  { num: '09', label: 'Sep' },
  { num: '10', label: 'Oct' },
  { num: '11', label: 'Nov' },
  { num: '12', label: 'Dec' },
];

function getAssessmentMonthKey(a: ResultAssessment): string | null {
  const dateStr = a.createdAtRaw || a.createdAt;
  if (!dateStr || dateStr === '—') return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatSelectedMonthsLabel(monthKeys: string[]): string {
  if (!monthKeys || monthKeys.length === 0) {
    return 'Select Months';
  }
  const sorted = [...monthKeys].sort();
  const monthMap: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
  };

  const byYear: Record<string, string[]> = {};
  for (const key of sorted) {
    const [yr, m] = key.split('-');
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(monthMap[m] || m);
  }

  const yearKeys = Object.keys(byYear).sort();

  if (sorted.length <= 3) {
    return yearKeys
      .map((yr) => `${byYear[yr].join(', ')} ${yr}`)
      .join(', ');
  }

  const firstTwo = sorted.slice(0, 2).map((key) => {
    const [yr, m] = key.split('-');
    return `${monthMap[m]} ${yr}`;
  }).join(', ');

  return `${firstTwo} (+${sorted.length - 2})`;
}

export function TeacherResults() {
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [assessmentList, setAssessmentList] = useState<ResultAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'all' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterClass, setFilterClass] = useState('all');

  // Calendar-style multi-month filter state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [tempSelectedMonths, setTempSelectedMonths] = useState<string[]>([]);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [viewingYear, setViewingYear] = useState<number>(new Date().getFullYear());
  const monthSelectorRef = useRef<HTMLDivElement>(null);

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

  // Close month selector popover when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        monthSelectorRef.current &&
        !monthSelectorRef.current.contains(event.target as Node)
      ) {
        setIsMonthSelectorOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMonthSelectorOpen(false);
      }
    }

    if (isMonthSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMonthSelectorOpen]);

  // Determine available years from data + current/adjacent years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear - 1);

    for (const a of assessmentList) {
      const key = getAssessmentMonthKey(a);
      if (key) {
        const y = parseInt(key.split('-')[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => a - b);
  }, [assessmentList]);

  const handleToggleMonthSelector = () => {
    if (!isMonthSelectorOpen) {
      setTempSelectedMonths([...selectedMonths]);
      if (selectedMonths.length > 0) {
        const firstSelectedYear = parseInt(selectedMonths[0].split('-')[0], 10);
        if (!isNaN(firstSelectedYear)) {
          setViewingYear(firstSelectedYear);
        }
      }
    }
    setIsMonthSelectorOpen((prev) => !prev);
  };

  const handleToggleMonth = (monthKey: string) => {
    setTempSelectedMonths((prev) =>
      prev.includes(monthKey)
        ? prev.filter((k) => k !== monthKey)
        : [...prev, monthKey]
    );
  };

  /* Base assessments by tab */
  const baseAssessments = useMemo(() => {
    if (!isHydrated) return [];
    if (activeTab === 'published') {
      return assessmentList.filter((a) => a.status === 'published');
    }
    return assessmentList;
  }, [isHydrated, assessmentList, activeTab]);

  /* Search & filter */
  const filteredAssessments = useMemo(() => {
    if (!isHydrated) return [];
    let list = baseAssessments;

    if (filterClass !== 'all') {
      list = list.filter((a) => a.displayClass === filterClass);
    }

    if (selectedMonths.length > 0) {
      const selectedSet = new Set(selectedMonths);
      list = list.filter((a) => {
        const key = getAssessmentMonthKey(a);
        return key !== null && selectedSet.has(key);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [isHydrated, baseAssessments, filterClass, selectedMonths, searchQuery]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filteredAssessments.length / ITEMS_PER_PAGE));
  const pagedAssessments = filteredAssessments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* Tab counts */
  const allCount = isHydrated ? assessmentList.length : 0;
  const publishedCount = isHydrated
    ? assessmentList.filter((a) => a.status === 'published').length
    : 0;

  /* Unique class names for filter dropdown */
  const classNames = isHydrated
    ? [...new Set(assessmentList.map((a) => a.displayClass))]
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

          {/* Calendar-style Multi-Month Selector Popover */}
          <div className="relative" ref={monthSelectorRef}>
            <button
              type="button"
              onClick={handleToggleMonthSelector}
              className={cn(
                'h-10 px-3.5 rounded-xl border bg-white text-sm font-medium transition-all cursor-pointer flex items-center gap-2 select-none',
                selectedMonths.length > 0
                  ? 'border-[#0d9488] text-slate-900 bg-[#f0fdfa]/40 ring-1 ring-[#0d9488]/30'
                  : isMonthSelectorOpen
                  ? 'border-[#0d9488] ring-2 ring-[#0d9488]/20 text-slate-900'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              )}
            >
              <Calendar className={cn('h-4 w-4 shrink-0', selectedMonths.length > 0 ? 'text-[#0d9488]' : 'text-slate-400')} />
              <span className="truncate max-w-[170px] sm:max-w-[210px]">
                {formatSelectedMonthsLabel(selectedMonths)}
              </span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-slate-400 transition-transform duration-200 rotate-90 shrink-0',
                  isMonthSelectorOpen && '-rotate-90 text-[#0d9488]'
                )}
              />
            </button>

            {/* Dropdown / Popover */}
            {isMonthSelectorOpen && (
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-[340px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-scale-in">
                {/* Year Header & Switcher */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewingYear((y) => y - 1)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Previous year"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                    {availableYears.map((yr) => {
                      const countInYear = tempSelectedMonths.filter((k) => k.startsWith(`${yr}-`)).length;
                      const isCurrentView = viewingYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setViewingYear(yr)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer',
                            isCurrentView
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100'
                          )}
                        >
                          <span>{yr}</span>
                          {countInYear > 0 && (
                            <span
                              className={cn(
                                'h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                                isCurrentView ? 'bg-[#0d9488] text-white' : 'bg-[#ccfbf1] text-[#0f766e]'
                              )}
                            >
                              {countInYear}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingYear((y) => y + 1)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Next year"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* 12 Months Grid */}
                <div className="grid grid-cols-4 gap-2 mb-3.5">
                  {MONTHS.map((m) => {
                    const key = `${viewingYear}-${m.num}`;
                    const isSelected = tempSelectedMonths.includes(key);
                    return (
                      <button
                        key={m.num}
                        type="button"
                        onClick={() => handleToggleMonth(key)}
                        className={cn(
                          'h-10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 select-none cursor-pointer',
                          isSelected
                            ? 'bg-[#0d9488] text-white shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-700 border border-slate-200/60'
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Status Text */}
                <div className="text-[11px] text-slate-500 mb-3 truncate font-normal px-0.5">
                  {tempSelectedMonths.length === 0 ? (
                    <span className="text-slate-400">All months (no specific filter)</span>
                  ) : (
                    <span>
                      Selected ({tempSelectedMonths.length}): <strong className="text-slate-700 font-medium">{formatSelectedMonthsLabel(tempSelectedMonths)}</strong>
                    </span>
                  )}
                </div>

                {/* Popover Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setTempSelectedMonths([])}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Clear
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMonthSelectorOpen(false)}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonths(tempSelectedMonths);
                        setIsMonthSelectorOpen(false);
                        setCurrentPage(1);
                      }}
                      className="h-8 px-3.5 rounded-lg bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
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

      {/* ──── Summary Card: Total Assessments Only ────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#eff6ff] border border-[#dbeafe] shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-[#dbeafe] text-[#2563eb] shadow-2xs shrink-0">
            <FileText className="h-6 w-6 text-[#2563eb]" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Assessments</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{filteredAssessments.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredAssessments.length === publishedCount
                ? `${publishedCount} published`
                : `${filteredAssessments.length} of ${publishedCount} published`}
            </p>
          </div>
        </div>

        {selectedMonths.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-center bg-white/95 border border-blue-200 px-3 py-1.5 rounded-xl text-xs text-slate-600 font-medium shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-[#0d9488]" />
            <span>Months: <strong className="text-slate-800 font-semibold">{formatSelectedMonthsLabel(selectedMonths)}</strong></span>
            <button
              type="button"
              onClick={() => {
                setSelectedMonths([]);
                setCurrentPage(1);
              }}
              className="text-slate-400 hover:text-rose-600 ml-1 font-bold leading-none cursor-pointer"
              title="Remove month filter"
            >
              ×
            </button>
          </div>
        )}
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
              {allCount}
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
              {publishedCount}
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
