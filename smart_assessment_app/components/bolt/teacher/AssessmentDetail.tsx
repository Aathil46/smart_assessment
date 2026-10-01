"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from '@/components/bolt/router';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/StatusIndicator';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, FileText, Users, TrendingUp, Clock,
  Search, Download, MoreVertical,
  ChevronDown, ChevronRight, Eye, Check,
  Leaf, FlaskConical, Atom, BarChart3, Target,
} from 'lucide-react';

/* ─── Avatar colour palette ─────────────────────────────────── */
const AVATAR_COLORS = [
  { bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]' }, // blue
  { bg: 'bg-[#fce7f3]', text: 'text-[#be185d]' }, // pink
  { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]' }, // emerald
  { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' }, // amber
  { bg: 'bg-[#ede9fe]', text: 'text-[#5b21b6]' }, // violet
  { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]' }, // red
  { bg: 'bg-[#ccfbf1]', text: 'text-[#115e59]' }, // teal
  { bg: 'bg-[#ffedd5]', text: 'text-[#9a3412]' }, // orange
  { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]' }, // sky
  { bg: 'bg-[#f0fdf4]', text: 'text-[#166534]' }, // green
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name || 'ST').slice(0, 2).toUpperCase();
}

/* ─── Custom Molecule Icon for Glucose matching reference image ─── */
function MoleculeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="7" cy="17" r="2.8" />
      <circle cx="17" cy="17" r="2.8" />
      <circle cx="12" cy="7" r="2.8" />
      <line x1="9.2" y1="14.8" x2="10.8" y2="9.5" />
      <line x1="14.8" y1="14.8" x2="13.2" y2="9.5" />
      <line x1="9.8" y1="17" x2="14.2" y2="17" />
    </svg>
  );
}

/* ─── Concepts Needing Support Data ───────────────────────────── */
interface SupportStudent {
  id: string;
  name: string;
  initials: string;
  score: number;
  status: 'needs-support';
  timeTaken: number;
  avatarColor: { bg: string; text: string };
}

interface ConceptItem {
  id: string;
  name: string;
  subtitle: string;
  studentCount: number;
  avgScore: number;
  classAvg: number;
  iconType: 'molecule' | 'leaf' | 'flask' | 'atom';
  students: SupportStudent[];
}

/* ─── Student row data for standard table ────────────────── */
interface StudentRow {
  id: string;
  name: string;
  initials: string;
  score: number | null;
  status: 'passed' | 'needs-support' | 'in-progress' | 'not-started';
  timeTaken: number | null;
  submittedOn: string | null;
}

type SortKey = 'recent' | 'az' | 'za' | 'highest' | 'lowest';
type TabKey  = 'all' | 'completed' | 'in-progress' | 'not-started' | 'needing-support';
type ConceptSortKey = 'most-support' | 'lowest-score' | 'highest-score' | 'az';

const SORT_LABELS: Record<SortKey, string> = {
  recent:  'Recent Submission',
  az:      'A to Z (Name)',
  za:      'Z to A (Name)',
  highest: 'Highest Score',
  lowest:  'Lowest Score',
};

const CONCEPT_SORT_LABELS: Record<ConceptSortKey, string> = {
  'most-support':  'Most Needing Support',
  'lowest-score':  'Lowest Avg Score',
  'highest-score': 'Highest Avg Score',
  'az':            'Concept Name (A-Z)',
};

export function AssessmentDetail() {
  const params = useParams();
  const assessmentId = (params?.id || params?.assessmentId) as string;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opens directly to 'all' (first section: All Students) when clicking View Results
  const [tab,                 setTab]                 = useState<TabKey>('all');
  const [search,              setSearch]              = useState('');
  const [sortKey,             setSortKey]             = useState<SortKey>('recent');
  const [showPublish,         setShowPublish]         = useState(false);

  // Students Needing Support Section State
  const [selectedConceptId,   setSelectedConceptId]   = useState<string>('');
  const [conceptSortKey,      setConceptSortKey]      = useState<ConceptSortKey>('most-support');
  const [supportStudentSearch,setSupportStudentSearch]= useState('');

  useEffect(() => {
    if (!assessmentId) return;

    async function loadAssessmentAndResults() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch assessment
        const aRes = await fetch(`/api/assessments/${assessmentId}`);
        if (!aRes.ok) {
          if (aRes.status === 404) {
            setError('Assessment not found');
            return;
          }
          throw new Error('Failed to load assessment');
        }
        const aJson = await aRes.json();
        setAssessmentData(aJson.assessment);

        // 2. Fetch results
        try {
          const rRes = await fetch(`/api/results/teacher/${assessmentId}`);
          if (rRes.ok) {
            const rJson = await rRes.json();
            setResultsData(rJson);
          }
        } catch {
          // No attempts yet
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading assessment');
      } finally {
        setLoading(false);
      }
    }

    loadAssessmentAndResults();
  }, [assessmentId]);

  /* ── map real student rows ── */
  const studentRows = useMemo<StudentRow[]>(() => {
    if (!resultsData?.studentResults) return [];
    return resultsData.studentResults.map((s: any) => {
      const isCompleted = s.status === 'Completed';
      const isFailed = s.passFail === 'Fail' || s.isWeakStudent;
      const status: StudentRow['status'] = isCompleted
        ? (isFailed ? 'needs-support' : 'passed')
        : (s.status === 'In Progress' ? 'in-progress' : 'not-started');

      const name = s.name || 'Student';
      return {
        id: s.student_id,
        name: name,
        initials: getInitials(name),
        score: s.percentage !== null && s.percentage !== undefined ? Math.round(s.percentage) : null,
        status: status,
        timeTaken: s.startedAt && s.submittedAt ? Math.max(1, Math.round((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)) : null,
        submittedOn: s.submittedAt ? formatDate(s.submittedAt) : null,
      };
    });
  }, [resultsData]);

  /* ── map real support concepts ── */
  const supportConcepts = useMemo<ConceptItem[]>(() => {
    const raw = (resultsData?.weakConcepts ?? []).concat(resultsData?.mediumConcepts ?? []);
    if (raw.length === 0) return [];
    const iconTypes: ConceptItem['iconType'][] = ['molecule', 'leaf', 'flask', 'atom'];
    return raw.map((c: any, idx: number) => {
      const cId = c.concept.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const affected = (c.affectedStudents ?? []).map((s: any, sIdx: number) => {
        const name = s.name || 'Student';
        return {
          id: s.student_id,
          name: name,
          initials: getInitials(name),
          score: Math.round(s.accuracyPercentage),
          status: 'needs-support' as const,
          timeTaken: 0,
          avatarColor: AVATAR_COLORS[sIdx % AVATAR_COLORS.length],
        };
      });

      return {
        id: cId,
        name: c.concept,
        subtitle: `${Math.round(c.accuracyPercentage)}% class accuracy`,
        studentCount: affected.length,
        avgScore: Math.round(c.accuracyPercentage),
        classAvg: Math.round(c.accuracyPercentage),
        iconType: iconTypes[idx % iconTypes.length],
        students: affected,
      };
    });
  }, [resultsData]);

  useEffect(() => {
    if (supportConcepts.length > 0 && !selectedConceptId) {
      setSelectedConceptId(supportConcepts[0].id);
    }
  }, [supportConcepts, selectedConceptId]);

  /* ── student counts & stats ── */
  const overview = resultsData?.overview;
  const totalStudents = overview?.totalStudents ?? studentRows.length;
  const completedCount = overview?.completed ?? studentRows.filter(s => s.status === 'passed' || s.status === 'needs-support').length;
  const inProgressCount = overview?.inProgress ?? studentRows.filter(s => s.status === 'in-progress').length;
  const notStartedCount = Math.max(0, totalStudents - completedCount - inProgressCount);
  const completionPct = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

  const completedScores = studentRows.filter(s => s.score !== null).map(s => s.score as number);
  const avgScore = completedScores.length > 0 ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length) : 0;
  const passCount = overview?.passed ?? studentRows.filter(s => s.status === 'passed').length;
  const passRate = completedCount > 0 ? Math.round((passCount / completedCount) * 100) : 0;
  const needingSupportCount = studentRows.filter(s => s.status === 'needs-support').length;

  const handlePublishAssessment = async () => {
    if (!assessmentData?.id) return;
    try {
      setPublishing(true);
      const res = await fetch(`/api/assessments/${assessmentData.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptLimit: 1 }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.error?.message || 'Failed to publish assessment');
        return;
      }
      setAssessmentData((prev: any) => ({ ...prev, status: 'published' }));
    } catch (err) {
      alert('Error publishing assessment');
    } finally {
      setPublishing(false);
    }
  };

  /* ── standard table filter & sort ── */
  const tabFiltered = useMemo(() => {
    if (tab === 'completed')    return studentRows.filter(s => s.status === 'passed' || s.status === 'needs-support');
    if (tab === 'in-progress')  return studentRows.filter(s => s.status === 'in-progress');
    if (tab === 'not-started')  return studentRows.filter(s => s.status === 'not-started');
    return studentRows;
  }, [tab, studentRows]);

  const searched = useMemo(() => {
    if (!search.trim()) return tabFiltered;
    return tabFiltered.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [tabFiltered, search]);

  const sorted = useMemo(() => {
    const arr = [...searched];
    if (sortKey === 'az')      return arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === 'za')      return arr.sort((a, b) => b.name.localeCompare(a.name));
    if (sortKey === 'highest') return arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    if (sortKey === 'lowest')  return arr.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    return arr;
  }, [searched, sortKey]);

  /* ── support concepts sorted ── */
  const sortedConcepts = useMemo(() => {
    const arr = [...supportConcepts];
    if (conceptSortKey === 'most-support') {
      return arr.sort((a, b) => b.studentCount - a.studentCount || a.avgScore - b.avgScore);
    }
    if (conceptSortKey === 'lowest-score') {
      return arr.sort((a, b) => a.avgScore - b.avgScore);
    }
    if (conceptSortKey === 'highest-score') {
      return arr.sort((a, b) => b.avgScore - a.avgScore);
    }
    if (conceptSortKey === 'az') {
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [conceptSortKey, supportConcepts]);

  const selectedConcept = useMemo(() => {
    return supportConcepts.find(c => c.id === selectedConceptId) || supportConcepts[0] || null;
  }, [selectedConceptId, supportConcepts]);

  /* ── filtered support students for selected concept ── */
  const filteredConceptStudents = useMemo(() => {
    if (!selectedConcept) return [];
    if (!supportStudentSearch.trim()) return selectedConcept.students;
    return selectedConcept.students.filter(s =>
      s.name.toLowerCase().includes(supportStudentSearch.toLowerCase())
    );
  }, [selectedConcept, supportStudentSearch]);

  const isRedTheme = tab === 'needing-support';

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-6 h-6 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading assessment details...</p>
      </div>
    );
  }

  if (error || !assessmentData) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title={error || "Assessment not found"}
        action={
          <button
            onClick={() => navigate('/teacher/assessments')}
            className="h-9 px-4 rounded-xl bg-[#0d9488] text-white text-sm font-medium cursor-pointer"
          >
            Back to Assessments
          </button>
        }
      />
    );
  }

  const clsName = assessmentData.classes?.name
    ? (assessmentData.classes.name.startsWith('"') && assessmentData.classes.name.endsWith('"')
        ? assessmentData.classes.name.slice(1, -1)
        : assessmentData.classes.name)
    : 'Class';

  return (
    <div className="space-y-6 pb-12">

      {/* ──── Breadcrumb back link ──────────────────────────── */}
      <button
        onClick={() => navigate('/teacher/assessments')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Assessments</span>
      </button>

      {/* ──── Assessment header card ────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Document icon */}
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border",
              isRedTheme
                ? "bg-[#fef2f2] border-red-100 text-[#dc2626]"
                : "bg-[#f0fdfa] border-[#ccfbf1] text-[#0d9488]"
            )}>
              <FileText className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{assessmentData.title}</h1>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
                  assessmentData.status === 'published'
                    ? (isRedTheme ? "bg-[#fee2e2] text-[#b91c1c] border-red-200/70" : "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]/60")
                    : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {assessmentData.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span>{clsName}</span>
                <span className="text-slate-300">|</span>
                <span>{totalStudents} students</span>
                <span className="text-slate-300">|</span>
                <span>{assessmentData.questions?.length ?? assessmentData.num_questions ?? 0} questions</span>
                <span className="text-slate-300">|</span>
                <span>{(assessmentData.questions?.length ?? assessmentData.num_questions ?? 10) * 3} min</span>
                <span className="text-slate-300">|</span>
                <span>{formatDate(assessmentData.opens_at || assessmentData.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {assessmentData.status === 'draft' && (
              <button
                type="button"
                onClick={() => setShowPublish(true)}
                disabled={publishing}
                className="h-9 px-4 rounded-xl bg-[#0d9488] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#0f766e] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{publishing ? 'Publishing...' : 'Publish Assessment'}</span>
              </button>
            )}
            <button
              type="button"
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* ──── 4 KPI stat cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Average Score */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-5 flex items-center gap-4 transition-all">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            isRedTheme ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f0fdfa] text-[#0d9488]"
          )}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Average Score</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{avgScore}%</p>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-5 flex items-center gap-4 transition-all">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            isRedTheme ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#fef2f2] text-[#dc2626]"
          )}>
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pass Rate</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{passRate}%</p>
          </div>
        </div>

        {/* Completed Students */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-5 flex items-center gap-4 transition-all">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            isRedTheme ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f0fdfa] text-[#0d9488]"
          )}>
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Completed Students</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{completedCount} / {totalStudents}</p>
            <p className="text-xs text-slate-400 mt-0.5">{completionPct}% completion</p>
          </div>
        </div>

        {/* In Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-5 flex items-center gap-4 transition-all">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            isRedTheme ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#fffbeb] text-[#d97706]"
          )}>
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">In Progress</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{inProgressCount} students</p>
            <p className="text-xs text-slate-400 mt-0.5">{Math.round((inProgressCount / totalStudents) * 100)}% of class</p>
          </div>
        </div>

      </div>

      {/* ──── Horizontal Tab Bar ────────────────────────────── */}
      <div className="border-b border-slate-200 flex items-center gap-6 overflow-x-auto pt-2">
        <button
          type="button"
          onClick={() => { setTab('all'); setSearch(''); }}
          className={cn(
            'pb-3 text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2',
            tab === 'all'
              ? 'border-[#0d9488] text-[#0d9488] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          All Students ({totalStudents})
        </button>

        <button
          type="button"
          onClick={() => { setTab('completed'); setSearch(''); }}
          className={cn(
            'pb-3 text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2',
            tab === 'completed'
              ? 'border-[#0d9488] text-[#0d9488] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          Completed ({completedCount})
        </button>

        <button
          type="button"
          onClick={() => { setTab('in-progress'); setSearch(''); }}
          className={cn(
            'pb-3 text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2',
            tab === 'in-progress'
              ? 'border-[#0d9488] text-[#0d9488] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          In Progress ({inProgressCount})
        </button>

        <button
          type="button"
          onClick={() => { setTab('not-started'); setSearch(''); }}
          className={cn(
            'pb-3 text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2',
            tab === 'not-started'
              ? 'border-[#0d9488] text-[#0d9488] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          Not Started ({notStartedCount})
        </button>

        {/* Students Needing Support tab with Red/Black Theme */}
        <button
          type="button"
          onClick={() => { setTab('needing-support'); }}
          className={cn(
            'pb-3 text-sm transition-all cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2',
            tab === 'needing-support'
              ? 'border-[#dc2626] text-[#dc2626] font-bold'
              : 'border-transparent text-slate-600 hover:text-[#dc2626] font-medium'
          )}
        >
          <Users className={cn('h-4 w-4', tab === 'needing-support' ? 'text-[#dc2626]' : 'text-slate-400')} />
          <span>Students Needing Support ({needingSupportCount})</span>
        </button>
      </div>

      {/* ──── SECTION CONTENT: Students Needing Support OR Standard Table ──── */}
      {tab === 'needing-support' ? (
        /* ════════════ STUDENTS NEEDING SUPPORT SECTION (RED/BLACK/WHITE THEME) ════════════ */
        <div className="space-y-6 animate-fade-in">

          {/* 1. Header Banner */}
          <div className="rounded-2xl border border-red-200/70 bg-gradient-to-r from-red-50 via-red-50/60 to-pink-50/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-red-100/90 text-red-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Students Needing Support</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  These are the concepts where students are struggling in this assessment.
                </p>
              </div>
            </div>

            {/* Right Badge */}
            <div className="self-start sm:self-center flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-100/80 border border-red-200/80 shadow-2xs">
              <div className="h-7 w-7 rounded-full bg-red-200/80 text-red-700 flex items-center justify-center flex-shrink-0">
                <Users className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {needingSupportCount} {needingSupportCount === 1 ? 'student needs' : 'students need'} support
                </p>
                <p className="text-2xs font-medium text-red-700">
                  across {sortedConcepts.length} {sortedConcepts.length === 1 ? 'concept' : 'concepts'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Main 2-Column Grid: Concepts on Left, Students on Right OR Clean Empty State */}
          {sortedConcepts.length === 0 || !selectedConcept ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No support needed</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                No students currently need targeted support for this assessment, or no submissions have been recorded yet.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: Concepts (4) */}
            <div className="lg:col-span-5 space-y-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-2 pb-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Concepts ({sortedConcepts.length})
                </h3>

                {/* Sort dropdown */}
                <Dropdown
                  align="right"
                  trigger={
                    <button
                      type="button"
                      className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Sort by: {CONCEPT_SORT_LABELS[conceptSortKey]}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  }
                >
                  {(Object.keys(CONCEPT_SORT_LABELS) as ConceptSortKey[]).map(k => (
                    <DropdownItem
                      key={k}
                      onClick={() => setConceptSortKey(k)}
                      icon={conceptSortKey === k ? <Check className="h-3.5 w-3.5 text-red-600" /> : <span className="h-3.5 w-3.5" />}
                    >
                      {CONCEPT_SORT_LABELS[k]}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>

              {/* Concept list */}
              <div className="space-y-3">
                {sortedConcepts.map(c => {
                  const isSelected = selectedConceptId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedConceptId(c.id);
                        setSupportStudentSearch('');
                      }}
                      className={cn(
                        'rounded-2xl border p-4 transition-all cursor-pointer relative overflow-hidden text-left group',
                        isSelected
                          ? 'border-red-300 bg-[#fffdfd] shadow-sm'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
                      )}
                    >
                      {/* Left red accent indicator bar on active card */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#dc2626]" />
                      )}

                      <div className="flex items-center justify-between gap-3">
                        {/* Icon & Title */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={cn(
                            'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                            isSelected
                              ? 'bg-[#fee2e2] text-[#dc2626]'
                              : c.iconType === 'molecule'
                                ? 'bg-red-50 text-red-600'
                                : c.iconType === 'leaf'
                                  ? 'bg-slate-100 text-slate-700'
                                  : c.iconType === 'flask'
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-red-50/80 text-red-600'
                          )}>
                            {c.iconType === 'molecule' && <MoleculeIcon className="h-5 w-5" />}
                            {c.iconType === 'leaf' && <Leaf className="h-5 w-5" />}
                            {c.iconType === 'flask' && <FlaskConical className="h-5 w-5" />}
                            {c.iconType === 'atom' && <Atom className="h-5 w-5" />}
                          </div>

                          <div className="min-w-0">
                            <h4 className={cn(
                              'text-sm font-bold truncate transition-colors',
                              isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-900 group-hover:text-red-600'
                            )}>
                              {c.name}
                            </h4>
                            <p className="text-xs text-slate-500 truncate mt-0.5 font-normal">
                              {c.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Right counts & score */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-700">
                              {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'}
                            </p>
                            <div className="flex items-center gap-1.5 justify-end mt-1">
                              <span className="w-1 h-3 rounded-full bg-red-600 inline-block" />
                              <span className="font-bold text-red-600 text-xs">{c.avgScore}%</span>
                              <span className="text-slate-400 text-xs">avg. score</span>
                            </div>
                          </div>

                          <ChevronRight className={cn(
                            'h-4 w-4 transition-transform',
                            isSelected ? 'text-red-600 translate-x-0.5' : 'text-slate-400 group-hover:text-slate-600'
                          )} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Selected Concept Details + Students Table */}
            <div className="lg:col-span-7 space-y-5">

              {/* 1. Selected Concept Header Card */}
              <div className="rounded-2xl border border-red-200/70 bg-gradient-to-r from-red-50/40 via-white to-white p-5 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-[#fee2e2] text-[#dc2626] flex items-center justify-center flex-shrink-0 shadow-xs">
                    {selectedConcept.iconType === 'molecule' && <MoleculeIcon className="h-6 w-6" />}
                    {selectedConcept.iconType === 'leaf' && <Leaf className="h-6 w-6" />}
                    {selectedConcept.iconType === 'flask' && <FlaskConical className="h-6 w-6" />}
                    {selectedConcept.iconType === 'atom' && <Atom className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 truncate">
                      {selectedConcept.name}
                    </h3>
                    <p className="text-sm text-slate-500 truncate mt-0.5">
                      {selectedConcept.subtitle}
                    </p>
                  </div>
                </div>

                {/* Class average stat block */}
                <div className="flex items-center gap-3.5 flex-shrink-0 pl-3">
                  <div className="h-11 w-11 rounded-xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#dc2626] tracking-tight">
                      {selectedConcept.classAvg}%
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      Class average
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Students Needing Support Table Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                {/* Table Toolbar */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Students needing support ({filteredConceptStudents.length})
                  </h4>

                  {/* Search inside concept students */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={supportStudentSearch}
                      onChange={e => setSupportStudentSearch(e.target.value)}
                      className="h-8 w-full sm:w-56 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[580px]">
                    <thead className="bg-slate-50/50">
                      <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                        <th className="py-3 pl-5 pr-3 w-8">#</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Time Taken</th>
                        <th className="py-3 pr-5 pl-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredConceptStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                            No students found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredConceptStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50/60 transition-colors group">
                            {/* # */}
                            <td className="py-3.5 pl-5 pr-3 text-xs text-slate-400 font-medium">
                              {idx + 1}
                            </td>

                            {/* Student */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                                  st.avatarColor.bg, st.avatarColor.text
                                )}>
                                  {st.initials}
                                </div>
                                <span className="font-medium text-slate-900">{st.name}</span>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-[#dc2626] text-sm">
                                {st.score}%
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]">
                                Needs Support
                              </span>
                            </td>

                            {/* Time Taken */}
                            <td className="py-3.5 px-4 text-slate-600 text-sm">
                              {st.timeTaken} min
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 pr-5 pl-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/teacher/results/${st.id}?assessmentId=${assessmentData.id}`)}
                                  className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
                                >
                                  View Details
                                </button>
                                <Dropdown
                                  align="right"
                                  trigger={
                                    <button
                                      type="button"
                                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  }
                                >
                                  <DropdownItem
                                    icon={<Eye className="h-4 w-4" />}
                                    onClick={() => navigate(`/teacher/results/${st.id}?assessmentId=${assessmentData.id}`)}
                                  >
                                    View Detailed Result
                                  </DropdownItem>
                                </Dropdown>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
          )}

        </div>
      ) : (
        /* ════════════ STANDARD RESULTS TABLE VIEW (ASSESSAI TEAL THEME) ════════════ */
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden animate-fade-in">

          {/* Table toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-800">
              {tab === 'all' && `All Students (${totalStudents})`}
              {tab === 'completed' && `Completed Students (${completedCount})`}
              {tab === 'in-progress' && `In Progress (${inProgressCount})`}
              {tab === 'not-started' && `Not Started (${notStartedCount})`}
            </div>

            {/* Search + Sort + Export */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Search */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 w-44 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-all"
                />
              </div>

              {/* Sort dropdown */}
              <Dropdown
                align="right"
                trigger={
                  <button
                    type="button"
                    className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span>{SORT_LABELS[sortKey]}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                }
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <DropdownItem
                    key={k}
                    onClick={() => setSortKey(k)}
                    icon={sortKey === k ? <Check className="h-3.5 w-3.5 text-[#0d9488]" /> : <span className="h-3.5 w-3.5" />}
                  >
                    {SORT_LABELS[k]}
                  </DropdownItem>
                ))}
              </Dropdown>

              {/* Export */}
              <button
                type="button"
                className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                  <th className="py-3 pl-5 pr-3 w-8">#</th>
                  <th className="py-3 px-4 w-[28%]">Student</th>
                  <th className="py-3 px-4 w-[10%]">Score</th>
                  <th className="py-3 px-4 w-[14%]">Status</th>
                  <th className="py-3 px-4 w-[12%]">Time Taken</th>
                  <th className="py-3 px-4 w-[22%]">Submitted On</th>
                  <th className="py-3 pr-5 pl-2 w-[14%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-14 text-slate-400">
                      No students match your search.
                    </td>
                  </tr>
                ) : (
                  sorted.map((student, idx) => {
                    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <tr
                        key={student.id}
                        className="group hover:bg-slate-50/60 transition-colors"
                      >
                        {/* # */}
                        <td className="py-3.5 pl-5 pr-3 text-xs text-slate-400 font-medium">
                          {idx + 1}
                        </td>

                        {/* Student */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                              color.bg, color.text
                            )}>
                              {student.initials}
                            </div>
                            <span className="font-medium text-slate-900">{student.name}</span>
                          </div>
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {student.score !== null ? `${student.score}%` : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={student.status} />
                        </td>

                        {/* Time Taken */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {student.timeTaken !== null ? `${student.timeTaken} min` : '—'}
                        </td>

                        {/* Submitted On */}
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {student.submittedOn ?? '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pr-5 pl-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/teacher/results/${student.id}?assessmentId=${assessmentData.id}`)}
                              className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                            >
                              View Details
                            </button>
                            <Dropdown
                              align="right"
                              trigger={
                                <button
                                  type="button"
                                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              }
                            >
                              <DropdownItem
                                icon={<Eye className="h-4 w-4" />}
                                onClick={() => navigate(`/teacher/results/${student.id}?assessmentId=${assessmentData.id}`)}
                              >
                                View Details
                              </DropdownItem>
                              <DropdownItem
                                icon={<Download className="h-4 w-4" />}
                                onClick={() => window.open(`/api/results/teacher/${assessmentData.id}/export`, '_blank')}
                              >
                                Export Result
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

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-white">
            <p className="text-xs text-slate-500">Showing {sorted.length} students</p>
          </div>
        </div>
      )}

      {/* ──── Publish confirm ───────────────────────────────── */}
      <ConfirmDialog
        open={showPublish}
        onClose={() => setShowPublish(false)}
        onConfirm={async () => {
          setShowPublish(false);
          await handlePublishAssessment();
        }}
        title="Publish Assessment?"
        message="Students will be notified immediately and can begin taking the assessment. This action cannot be undone."
        confirmLabel="Publish"
      />
    </div>
  );
}

/* ─── Status badge component ─────────────────────────────────── */
function StatusBadge({ status }: { status: StudentRow['status'] }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#f0fdf4] text-[#15803d]">
        Passed
      </span>
    );
  }
  if (status === 'needs-support') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#fff1f2] text-[#be123c]">
        Needs Support
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#fffbeb] text-[#92400e]">
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">
      Not Started
    </span>
  );
}
