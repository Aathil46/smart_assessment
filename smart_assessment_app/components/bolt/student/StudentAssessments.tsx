"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from '@/components/bolt/router';
import { PageHeader } from '@/components/shared/StatCard';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ClipboardPen, Clock, FileText, ArrowRight, CheckCircle2,
  AlertCircle, Play, Calendar,
} from 'lucide-react';
import { formatCountdown } from '@/lib/scheduling';

export interface ToDoAssessment {
  id: string;
  attemptId: string | null;
  title: string;
  topic?: string | null;
  classId: string;
  className: string;
  subject?: string | null;
  teacher?: string;
  questions: number;
  duration: number;
  dueDate: string;
  status: 'not-started' | 'in-progress';
  opensAt?: string | null;
  closesAt?: string | null;
}

export interface CompletedAssessment {
  id: string;
  attemptId: string;
  title: string;
  topic?: string | null;
  classId: string;
  className: string;
  subject?: string | null;
  teacher?: string;
  questions: number;
  duration: number;
  score: number;
  passed: boolean;
  completedDate: string;
  rank?: number;
  status: 'completed';
}

export function StudentAssessments() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todo');
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toDo, setToDo] = useState<ToDoAssessment[]>([]);
  const [completed, setCompleted] = useState<CompletedAssessment[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsHydrated(true);
    let isCancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError('');
        const res = await fetch('/api/assessments');
        const data = await res.json();
        if (isCancelled) return;
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Failed to load assessments');
        }
        setToDo(data.toDo || []);
        setCompleted(data.completed || []);
      } catch (err) {
        if (!isCancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load assessments.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="View and take your assigned assessments." />

      {loadError && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          {loadError}
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'todo', label: 'To Do', icon: <Clock className="h-3.5 w-3.5" />, count: toDo.length },
          { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-3.5 w-3.5" />, count: completed.length },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === 'todo' && (
        <div className="space-y-3 stagger">
          {!isHydrated || loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 rounded bg-slate-100" />
                    <div className="h-4 w-1/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                  <div className="h-9 w-20 rounded-lg bg-slate-100 shrink-0" />
                </div>
              ))}
            </div>
          ) : toDo.length > 0 ? (
            toDo.map((a) => {
              const isScheduledFuture = !!a.opensAt && new Date(a.opensAt).getTime() > now;
              const countdownMs = isScheduledFuture ? new Date(a.opensAt!).getTime() - now : 0;
              const countdownStr = isScheduledFuture ? formatCountdown(countdownMs) : '';

              return (
                <Card
                  key={a.id}
                  hover={!isScheduledFuture}
                  onClick={() => !isScheduledFuture && navigate(`/student/assessments/${a.id}/take`)}
                  className={isScheduledFuture ? 'opacity-90' : undefined}
                >
                  <CardBody className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600 flex-shrink-0">
                      <ClipboardPen className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 truncate">{a.title}</h3>
                        {isScheduledFuture && (
                          <Badge variant="brand" size="sm">
                            <Calendar className="h-3 w-3" /> Scheduled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{a.className}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {a.questions} questions</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.duration} min</span>
                        {isScheduledFuture ? (
                          <span className="flex items-center gap-1 text-brand-600 font-medium">
                            <Calendar className="h-3.5 w-3.5" />
                            Starts {new Date(a.opensAt!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            <span className="text-slate-400 font-normal">({countdownStr})</span>
                          </span>
                        ) : (
                          <Badge variant="warning" size="sm" dot>Due {a.dueDate}</Badge>
                        )}
                      </div>
                    </div>
                    {isScheduledFuture ? (
                      <Button
                        size="md"
                        disabled
                        className="flex-shrink-0 opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border border-slate-200"
                      >
                        <Clock className="h-4 w-4" /> Starts in {countdownStr}
                      </Button>
                    ) : (
                      <Button
                        size="md"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/student/assessments/${a.id}/take`);
                        }}
                      >
                        {a.status === 'in-progress' ? (
                          'Resume'
                        ) : (
                          <>
                            <Play className="h-4 w-4" /> Start
                          </>
                        )}
                      </Button>
                    )}
                  </CardBody>
                </Card>
              );
            })
          ) : (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="All caught up!" description="No pending assessments right now. Great job!" />
          )}
        </div>
      )}

      {tab === 'completed' && (
        <div className="space-y-3 stagger">
          {!isHydrated || loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 rounded bg-slate-100" />
                    <div className="h-4 w-1/4 rounded bg-slate-100" />
                  </div>
                  <div className="h-9 w-20 rounded-lg bg-slate-100 shrink-0" />
                </div>
              ))}
            </div>
          ) : completed.length > 0 ? (
            completed.map((a) => (
              <Card key={a.id} hover onClick={() => navigate(`/student/results/${a.attemptId || a.id}`)}>
                <CardBody className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0 ${a.passed ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'}`}>
                    {a.passed ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">{a.title}</h3>
                    <p className="text-sm text-slate-500">{a.className} · Completed {a.completedDate}</p>
                    {a.rank && <p className="text-xs text-slate-400 mt-1">Class Rank: #{a.rank}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-2xl font-bold ${a.passed ? 'text-success-600' : 'text-error-600'}`}>{a.score}%</p>
                    <Badge variant={a.passed ? 'success' : 'error'} size="sm">{a.passed ? 'Passed' : 'Failed'}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </CardBody>
              </Card>
            ))
          ) : (
            <EmptyState icon={<ClipboardPen className="h-6 w-6" />} title="No completed assessments" description="Your completed assessments will appear here." />
          )}
        </div>
      )}
    </div>
  );
}
