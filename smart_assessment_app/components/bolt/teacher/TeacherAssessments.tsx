"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from '@/components/bolt/router';
import {
  Plus, FileText, Clock, MoreVertical,
  Trash2, Eye, Edit3, Share2, Calendar, Check,
} from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';

export interface AssessmentItem {
  id: string;
  title: string;
  description: string;
  displayClass: string;
  questionCount: number;
  duration: number; // in minutes
  status: 'published' | 'draft';
  createdAt: string; // e.g. "Aug 28, 2024"
  color: 'teal' | 'blue' | 'amber' | 'purple' | 'rose' | 'sky';
}

const COLOR_PALETTE: AssessmentItem['color'][] = ['teal', 'blue', 'amber', 'purple', 'rose', 'sky'];

function getColorForId(id: string): AssessmentItem['color'] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % COLOR_PALETTE.length;
  }
  return COLOR_PALETTE[hash] || 'teal';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const iconColorClasses: Record<AssessmentItem['color'], { bg: string; border: string; text: string }> = {
  teal: { bg: 'bg-[#f0fdfa]', border: 'border-[#ccfbf1]', text: 'text-[#0d9488]' },
  blue: { bg: 'bg-[#eff6ff]', border: 'border-[#dbeafe]', text: 'text-[#2563eb]' },
  amber: { bg: 'bg-[#fffbeb]', border: 'border-[#fef3c7]', text: 'text-[#d97706]' },
  purple: { bg: 'bg-[#faf5ff]', border: 'border-[#f3e8ff]', text: 'text-[#9333ea]' },
  rose: { bg: 'bg-[#fff1f2]', border: 'border-[#ffe4e6]', text: 'text-[#e11d48]' },
  sky: { bg: 'bg-[#f0f9ff]', border: 'border-[#e0f2fe]', text: 'text-[#0284c7]' },
};

export function TeacherAssessments() {
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [assessmentList, setAssessmentList] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft'>('all');

  useEffect(() => {
    setIsHydrated(true);
    let isCancelled = false;

    async function loadAssessments() {
      try {
        setLoading(true);
        const res = await fetch('/api/assessments');
        if (!res.ok) throw new Error('Failed to load assessments');
        const data = await res.json();
        if (isCancelled) return;
        const raw = data.assessments ?? [];
        const mapped: AssessmentItem[] = raw.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.topic || `Assessment for ${a.classes?.name ?? 'Class'}`,
          displayClass: a.classes?.name ? (a.classes.name.startsWith('"') && a.classes.name.endsWith('"') ? a.classes.name.slice(1, -1) : a.classes.name) : 'Class',
          questionCount: a.questions?.length || a.num_questions || 0,
          duration: (a.opens_at && a.closes_at)
            ? Math.max(5, Math.round((new Date(a.closes_at).getTime() - new Date(a.opens_at).getTime()) / 60000))
            : ((a.questions?.length || a.num_questions || 10) * 3),
          status: a.status === 'published' ? 'published' : 'draft',
          createdAt: formatDate(a.created_at),
          color: getColorForId(a.id),
        }));
        setAssessmentList(mapped);
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching assessments:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadAssessments();

    return () => {
      isCancelled = true;
    };
  }, []);

  const publishedCount = isHydrated ? assessmentList.filter((a) => a.status === 'published').length : 0;
  const draftCount = isHydrated ? assessmentList.filter((a) => a.status === 'draft').length : 0;
  const allCount = isHydrated ? assessmentList.length : 0;

  const filteredAssessments = !isHydrated
    ? []
    : assessmentList.filter((a) => {
        if (activeTab === 'published') return a.status === 'published';
        if (activeTab === 'draft') return a.status === 'draft';
        return true;
      });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return;
    try {
      const res = await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message || 'Failed to delete assessment');
        return;
      }
      setAssessmentList((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert('An error occurred while deleting the assessment');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assessments</h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">
            Create and manage AI-generated assessments for your classes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/teacher/assessments/create')}
          className="h-10 px-5 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white font-medium text-sm shadow-xs flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Create Assessment</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-transparent">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
            activeTab === 'all'
              ? 'bg-[#e6f7f5] text-[#0d9488] font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <span>All</span>
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
          onClick={() => setActiveTab('published')}
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

        <button
          type="button"
          onClick={() => setActiveTab('draft')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
            activeTab === 'draft'
              ? 'bg-[#e6f7f5] text-[#0d9488] font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <span>Drafts</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold',
              activeTab === 'draft' ? 'bg-[#0d9488] text-white' : 'bg-slate-200 text-slate-600'
            )}
          >
            {draftCount}
          </span>
        </button>
      </div>

      {/* Table Card Container */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-400 select-none">
                <th className="py-4 pl-6 pr-4 w-[36%]">Assessment</th>
                <th className="py-4 px-4 w-[12%]">Class</th>
                <th className="py-4 px-4 w-[12%]">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>Questions</span>
                  </div>
                </th>
                <th className="py-4 px-4 w-[12%]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Duration</span>
                  </div>
                </th>
                <th className="py-4 px-4 w-[12%]">Status</th>
                <th className="py-4 px-4 w-[12%]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Created</span>
                  </div>
                </th>
                <th className="py-4 pr-6 pl-2 w-[4%] text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {!isHydrated || loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                      <span>Loading assessments...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No assessments found in this tab.
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((a) => {
                  const style = iconColorClasses[a.color];
                  return (
                    <tr
                      key={a.id}
                      className="group hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Column 1: Assessment icon, title, description */}
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

                      {/* Column 2: Class */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">
                          {a.displayClass}
                        </span>
                      </td>

                      {/* Column 3: Number of Questions */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {a.questionCount}
                      </td>

                      {/* Column 4: Duration */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-600 font-normal">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{a.duration} min</span>
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {a.status === 'published' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]/60 flex items-center gap-1.5 w-fit">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                            Published
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 w-fit">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Column 6: Created Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500 font-normal">
                        {a.createdAt}
                      </td>

                      {/* Column 7: More Actions */}
                      <td className="py-4 pr-6 pl-2 text-right whitespace-nowrap">
                        <Dropdown
                          trigger={
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-auto cursor-pointer"
                              aria-label="Assessment actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          }
                        >
                          <DropdownItem
                            icon={<Eye className="h-4 w-4" />}
                            onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                          >
                            View Assessment
                          </DropdownItem>
                          <DropdownItem
                            icon={<Edit3 className="h-4 w-4" />}
                            onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                          >
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            icon={<Share2 className="h-4 w-4" />}
                            onClick={() => {
                              navigator.clipboard?.writeText(window.location.origin + `/student/assessments/${a.id}`);
                            }}
                          >
                            Share Link
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem
                            icon={<Trash2 className="h-4 w-4" />}
                            danger
                            onClick={() => handleDelete(a.id)}
                          >
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
