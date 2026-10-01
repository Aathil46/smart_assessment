"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigate } from '@/components/bolt/router';
import { Plus, BookOpen, User, ClipboardPen, ArrowRight, CheckCircle2, Clock3, Award, BarChart3 } from 'lucide-react';

export interface EnrolledClass {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  code: string;
  teacher: string;
  assessmentCount: number;
  avgScore: number | null;
  nextAssessment: string | null;
  joinedAt?: string;
  createdAt?: string;
}

const classVisuals = [
  { accent: 'border-teal-600', icon: 'text-teal-800', soft: 'bg-teal-50', badge: 'bg-teal-100 text-teal-800' },
  { accent: 'border-amber-500', icon: 'text-amber-800', soft: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
  { accent: 'border-teal-500', icon: 'text-teal-700', soft: 'bg-slate-50', badge: 'bg-teal-50 text-teal-800' },
];

export function StudentClasses() {
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const response = await fetch('/api/classes');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to load classes.');
      }
      setClasses(payload.classes || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsHydrated(true);
    fetchClasses();
  }, [fetchClasses]);

  const handleJoin = async () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) return setError('Please enter a class code');
    if (trimmed.length !== 6) return setError('Class code must be 6 characters');
    setError('');
    setJoining(true);
    try {
      const response = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message || 'Failed to join class');
        return;
      }
      setShowJoin(false);
      setJoinCode('');
      await fetchClasses();
    } catch {
      setError('An unexpected error occurred while joining the class');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        description="Classes you're enrolled in."
        action={<Button onClick={() => setShowJoin(true)}><Plus className="h-4 w-4" /> Join Class</Button>}
      />

      {loadError && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          {loadError}
        </div>
      )}

      {!isHydrated || loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 animate-pulse min-h-[410px]">
              <div className="flex justify-between items-center mb-6">
                <div className="h-12 w-12 rounded-2xl bg-slate-100" />
                <div className="h-6 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-6 w-3/4 rounded bg-slate-100 mb-2" />
              <div className="h-4 w-1/2 rounded bg-slate-100 mb-6" />
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="h-20 rounded-xl bg-slate-100" />
                <div className="h-20 rounded-xl bg-slate-100" />
              </div>
              <div className="h-16 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No classes yet"
          description="Join a class using the code your teacher gave you."
          action={<Button onClick={() => setShowJoin(true)}><Plus className="h-4 w-4" /> Join Class</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((c, index) => {
            const visual = classVisuals[index % classVisuals.length];
            const hasNext = Boolean(c.nextAssessment);
            return (
              <div
                key={c.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
              >
                <div className={`h-1.5 border-t-4 ${visual.accent}`} />

                <div className="relative min-h-[410px] overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
                  <div className="pointer-events-none absolute inset-0 opacity-40">
                    <div className="absolute -right-10 top-8 h-36 w-36 rounded-full border border-slate-300/70" />
                    <div className="absolute right-8 top-16 h-20 w-20 rounded-full border border-slate-200" />
                    <div className="absolute left-8 top-28 h-24 w-24 rounded-3xl border border-slate-200 rotate-12" />
                    <div className="absolute bottom-10 left-14 h-20 w-20 rounded-full border border-slate-200" />
                    <div className="absolute bottom-8 right-12 h-28 w-28 rounded-[40%] border border-slate-200 -rotate-12" />
                    <div className="absolute left-1/3 top-1/2 h-px w-1/2 bg-slate-200 rotate-12" />
                  </div>

                  <div className="relative z-10 p-5">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 ${visual.soft} shadow-sm`}>
                        <BookOpen className={`h-6 w-6 ${visual.icon}`} />
                      </div>
                      <div className={`rounded-full px-3 py-1 text-sm font-bold shadow-sm ${visual.badge}`}>{c.grade || c.subject || 'Class'}</div>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{c.name}</h3>
                      <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{c.teacher || 'Teacher'}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <ClipboardPen className="h-4 w-4" />
                          <span className="text-xs">Assessments</span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{c.assessmentCount ?? 0}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-xs">Avg Score</span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{c.avgScore !== null && c.avgScore !== undefined ? `${c.avgScore}%` : '—'}</p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        Up Next
                      </div>
                      <div className={`flex min-h-[68px] items-center gap-3 rounded-xl border px-3.5 ${hasNext ? 'border-slate-200 bg-white/90' : 'border-teal-100 bg-teal-50/80'}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasNext ? 'bg-amber-50 text-amber-800' : 'bg-teal-100 text-teal-700'}`}>
                          {hasNext ? <BookOpen className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{hasNext ? c.nextAssessment : 'No pending assessments'}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{hasNext ? 'Next assessment in this class' : 'You are all caught up'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center border-t border-white/70 bg-white/85 px-5 py-3 backdrop-blur-sm">
                    <button
                      onClick={() => navigate(`/student/assessments?class=${c.id}`)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
                    >
                      View Class <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showJoin}
        onClose={() => !joining && setShowJoin(false)}
        title="Join a Class"
        description="Enter the class code your teacher gave you."
        footer={
          <>
            <Button variant="outline" onClick={() => !joining && setShowJoin(false)} disabled={joining}>Cancel</Button>
            <Button onClick={handleJoin} loading={joining}>Join Class</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Class Code"
            placeholder="e.g., ALG2P3"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
            error={error}
            hint="The code is case-insensitive. Ask your teacher if you don't have one."
          />
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
            <div className="flex items-start gap-2">
              <Award className="mt-0.5 h-4 w-4 text-brand-600" />
              <p className="text-xs text-brand-700">You'll be enrolled immediately and can see all upcoming assessments.</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
