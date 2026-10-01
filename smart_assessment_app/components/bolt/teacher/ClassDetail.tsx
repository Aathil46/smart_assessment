"use client";

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@/components/bolt/router';
import { SectionTitle } from '@/components/shared/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { BarChart, DonutChart } from '@/components/ui/Charts';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ArrowLeft, Users, ClipboardPen, TrendingUp, Copy, Check,
  FileText, Plus, BookOpen, GraduationCap,
} from 'lucide-react';

interface StudentItem {
  id: string;
  name: string;
  avatar: string;
  avgScore: number;
  assessmentsTaken: number;
  lastActive: string;
}

interface AssessmentItem {
  id: string;
  title: string;
  questionCount: number;
  duration: number;
  avgScore: number;
  participation: {
    completed: number;
    total: number;
  };
  status: 'published' | 'draft';
  createdAt: string;
}

interface ClassDetailData {
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
    joinCode: string;
    studentCount: number;
    assessmentCount: number;
    avgPerformance: number | null;
    passRate: number | null;
    color: string;
    createdAt: string;
  };
  students: StudentItem[];
  assessments: AssessmentItem[];
  performanceData: { label: string; value: number; color?: string }[];
  participation: { label: string; value: number; color: string }[];
  completedRate: string;
}

export function ClassDetail({ classId: propClassId }: { classId?: string } = {}) {
  const params = useParams();
  const classId = (propClassId || params?.classId) as string;
  const navigate = useNavigate();
  const [tab, setTab] = useState('students');
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClassDetailData | null>(null);

  useEffect(() => {
    if (!classId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/classes/${classId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || 'Failed to load class.');
        if (isMounted) setData(json);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Class not found.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [classId]);

  const copyCode = () => {
    if (!data?.class?.joinCode) return;
    navigator.clipboard?.writeText(data.class.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/teacher/classes')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Classes
        </button>
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !data.class) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        title="Class not found"
        description="This class may have been deleted or you do not have permission to view it."
        action={<Button onClick={() => navigate('/teacher/classes')}>Back to Classes</Button>}
      />
    );
  }

  const cls = data.class;
  const students = data.students || [];
  const classAssessments = data.assessments || [];
  const performanceData = data.performanceData || [];
  const participationSegments = data.participation || [
    { label: 'Completed', value: 0, color: '#0d9488' },
    { label: 'In Progress', value: 0, color: '#f59e0b' },
    { label: 'Not Started', value: 100, color: '#e2e8f0' },
  ];
  const completedCenterValue = data.completedRate || '0%';

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/teacher/classes')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Classes
      </button>

      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neutral" size="sm" className="bg-white/15 text-white border-white/20">{cls.grade}</Badge>
              <Badge variant="neutral" size="sm" className="bg-white/15 text-white border-white/20">{cls.subject}</Badge>
            </div>
            <h1 className="text-2xl font-bold mb-1">{cls.name}</h1>
            <p className="text-sm text-white/80">{cls.studentCount} students · {cls.assessmentCount} assessments</p>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/10 backdrop-blur-sm">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-white/60">Join Code</p>
              <p className="text-sm font-mono font-bold">{cls.joinCode}</p>
            </div>
            <button onClick={copyCode} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users className="h-4.5 w-4.5" /></div>
            <div><p className="text-2xs text-slate-400 uppercase">Students</p><p className="text-xl font-bold text-slate-900">{cls.studentCount}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><ClipboardPen className="h-4.5 w-4.5" /></div>
            <div><p className="text-2xs text-slate-400 uppercase">Assessments</p><p className="text-xl font-bold text-slate-900">{cls.assessmentCount}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-600"><TrendingUp className="h-4.5 w-4.5" /></div>
            <div><p className="text-2xs text-slate-400 uppercase">Avg Performance</p><p className="text-xl font-bold text-slate-900">{cls.avgPerformance !== null ? `${cls.avgPerformance}%` : '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-50 text-info-600"><GraduationCap className="h-4.5 w-4.5" /></div>
            <div><p className="text-2xs text-slate-400 uppercase">Pass Rate</p><p className="text-xl font-bold text-slate-900">{cls.passRate !== null && cls.passRate !== undefined ? `${cls.passRate}%` : '—'}</p></div>
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: 'students', label: 'Students', icon: <Users className="h-3.5 w-3.5" />, count: cls.studentCount },
          { id: 'assessments', label: 'Assessments', icon: <ClipboardPen className="h-3.5 w-3.5" />, count: classAssessments.length },
          { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-3.5 w-3.5" /> },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === 'students' && (
        <Card>
          <CardHeader>
            <SectionTitle
              title="Enrolled Students"
              description={`${students.length} students enrolled`}
              action={
                <Button variant="outline" size="sm" onClick={copyCode}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Plus className="h-3.5 w-3.5" />}
                  {copied ? 'Code Copied!' : 'Add Student'}
                </Button>
              }
            />
          </CardHeader>
          <CardBody className="p-0">
            {students.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="No students yet" description="Share the join code with your students." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-2xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3">Student</th>
                      <th className="text-left text-2xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3 hidden sm:table-cell">Assessments Taken</th>
                      <th className="text-left text-2xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3">Avg Score</th>
                      <th className="text-left text-2xs font-semibold uppercase tracking-wide text-slate-400 px-4 py-3 hidden md:table-cell">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar initials={s.avatar} size="sm" color="brand" />
                            <span className="text-sm font-medium text-slate-900">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-slate-600">{s.assessmentsTaken}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <Progress
                                value={s.avgScore}
                                size="sm"
                                variant={s.avgScore >= 70 ? 'success' : s.avgScore >= 50 ? 'warning' : 'error'}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{s.avgScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-500">{s.lastActive}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'assessments' && (
        <Card>
          <CardHeader>
            <SectionTitle
              title="Class Assessments"
              action={
                <Button size="sm" onClick={() => navigate(`/teacher/assessments/create?classId=${cls.id}`)}>
                  <Plus className="h-3.5 w-3.5" /> Create Assessment
                </Button>
              }
            />
          </CardHeader>
          <CardBody className="p-0">
            {classAssessments.length === 0 ? (
              <EmptyState
                icon={<ClipboardPen className="h-6 w-6" />}
                title="No assessments yet"
                description="Create your first assessment for this class."
                action={
                  <Button size="sm" onClick={() => navigate(`/teacher/assessments/create?classId=${cls.id}`)}>
                    <Plus className="h-3.5 w-3.5" /> Create Assessment
                  </Button>
                }
              />
            ) : (
              classAssessments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                  className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.questionCount} questions · {a.duration} min</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-slate-700">
                      {a.participation.completed}/{a.participation.total}
                    </p>
                    <p className="text-2xs text-slate-400">completed</p>
                  </div>
                  {a.status === 'published' ? (
                    <Badge variant="success" size="sm">Published</Badge>
                  ) : (
                    <Badge variant="default" size="sm">Draft</Badge>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><SectionTitle title="Assessment Performance" description="Average score per assessment" /></CardHeader>
            <CardBody>
              {performanceData.length > 0 ? (
                <BarChart data={performanceData} height={200} showValues />
              ) : (
                <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No data yet" description="Publish assessments to see analytics." />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><SectionTitle title="Participation Rate" description="Student engagement" /></CardHeader>
            <CardBody className="flex flex-col items-center">
              <DonutChart
                segments={participationSegments}
                centerValue={completedCenterValue}
                centerLabel="Completed"
              />
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <span className="text-xs text-slate-600">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
                  <span className="text-xs text-slate-600">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-600">Not Started</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
