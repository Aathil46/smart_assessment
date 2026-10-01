"use client";

import { useNavigate } from '@/components/bolt/router';
import { StatCard, PageHeader, SectionTitle } from '@/components/shared/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { BarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApp } from '@/context/AppContext';
import { classes, assessments, studentResults, teachingInsights } from '@/data/mockData';
import {
  Users, ClipboardPen, GraduationCap, TrendingUp,
  Plus, ArrowRight, AlertTriangle, Lightbulb, Sparkles,
  FileText, Clock, CheckCircle2, BookOpen,
} from 'lucide-react';

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const myClasses = classes.filter(c => c.teacherId === user.id);
  const myAssessments = assessments.filter(a => myClasses.some(c => c.id === a.classId));
  const publishedAssessments = myAssessments.filter(a => a.status === 'published');
  const draftAssessments = myAssessments.filter(a => a.status === 'draft');
  const totalStudents = myClasses.reduce((sum, c) => sum + c.studentCount, 0);
  const avgPerformance = Math.round(myClasses.reduce((sum, c) => sum + c.avgPerformance, 0) / myClasses.length);
  const highPriorityInsights = teachingInsights.filter(i => i.priority === 'high');

  const participationData = publishedAssessments.map(a => ({
    label: a.title.split(' ').slice(0, 2).join(' '),
    value: Math.round((a.participation.completed / a.participation.total) * 100),
    color: 'bg-brand-500',
  }));

  const passFailSegments = [
    { label: 'Pass', value: Math.round(avgPerformance * 0.82), color: '#22c55e' },
    { label: 'Fail', value: Math.round(avgPerformance * 0.18), color: '#ef4444' },
  ];

  const trendData = [
    { label: 'Aug 28', value: 68 },
    { label: 'Aug 30', value: 72 },
    { label: 'Sep 1', value: 70 },
    { label: 'Sep 3', value: 75 },
    { label: 'Sep 5', value: 78 },
    { label: 'Sep 7', value: 76 },
  ];

  const recentSubmissions = studentResults.slice(0, 5);
  const weakConcepts = [
    { concept: 'Vertex Form', score: 48, class: 'Algebra II' },
    { concept: 'HL Theorem', score: 52, class: 'Geometry' },
    { concept: 'Completing the Square', score: 58, class: 'Algebra II' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Here's what's happening across your classes today."
        action={
          <Button onClick={() => navigate('/teacher/assessments')}>
            <Plus className="h-4 w-4" /> Create Assessment
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard label="Active Classes" value={myClasses.length} icon={<BookOpen className="h-5 w-5" />} color="brand" />
        <StatCard label="Total Students" value={totalStudents} icon={<Users className="h-5 w-5" />} color="info" />
        <StatCard label="Published Assessments" value={publishedAssessments.length} icon={<ClipboardPen className="h-5 w-5" />} color="accent" trend={{ value: '+3', direction: 'up' }} />
        <StatCard label="Avg Performance" value={avgPerformance} unit="%" icon={<TrendingUp className="h-5 w-5" />} color="success" trend={{ value: '+5%', direction: 'up' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance trend */}
          <Card>
            <CardHeader>
              <SectionTitle title="Performance Trend" description="Average score across all assessments" />
            </CardHeader>
            <CardBody>
              <LineChart data={trendData} height={200} />
            </CardBody>
          </Card>

          {/* Recent assessments */}
          <Card>
            <CardHeader>
              <SectionTitle
                title="Recent Assessments"
                action={<Button variant="ghost" size="sm" onClick={() => navigate('/teacher/assessments')}>View All <ArrowRight className="h-3.5 w-3.5" /></Button>}
              />
            </CardHeader>
            <CardBody className="p-0">
              {myAssessments.slice(0, 4).map(a => {
                const cls = myClasses.find(c => c.id === a.classId);
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/teacher/assessments/${a.id}`)}
                    className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${cls?.color || 'brand'}-100 text-${cls?.color || 'brand'}-600 flex-shrink-0`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.className} · {a.questionCount} questions</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Participation</p>
                        <p className="text-sm font-semibold text-slate-700">{a.participation.completed}/{a.participation.total}</p>
                      </div>
                      {a.status === 'published' ? (
                        <StatusIndicator status="success" label="Published" />
                      ) : (
                        <StatusIndicator status="pending" label="Draft" />
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* Recent submissions */}
          <Card>
            <CardHeader>
              <SectionTitle title="Recent Submissions" description="Latest student assessment submissions" />
            </CardHeader>
            <CardBody className="p-0">
              {recentSubmissions.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <Avatar initials={r.studentAvatar} size="sm" color="brand" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.studentName}</p>
                    <p className="text-xs text-slate-500 truncate">{r.assessmentTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${r.passed ? 'text-success-600' : 'text-error-600'}`}>{r.score}%</p>
                    <p className="text-2xs text-slate-400">{r.timeSpent}m</p>
                  </div>
                  {r.passed ? (
                    <Badge variant="success" size="sm">Pass</Badge>
                  ) : (
                    <Badge variant="error" size="sm">Fail</Badge>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Right column - sidebar content */}
        <div className="space-y-6">
          {/* Pass/Fail */}
          <Card>
            <CardHeader>
              <SectionTitle title="Pass Rate" description="Across all assessments" />
            </CardHeader>
            <CardBody className="flex flex-col items-center">
              <DonutChart
                segments={passFailSegments}
                size={160}
                centerValue={`${Math.round((passFailSegments[0].value / (passFailSegments[0].value + passFailSegments[1].value)) * 100)}%`}
                centerLabel="Pass Rate"
              />
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
                  <span className="text-xs text-slate-600">Pass</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-error-500" />
                  <span className="text-xs text-slate-600">Fail</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Weak concepts */}
          <Card>
            <CardHeader>
              <SectionTitle title="Weak Concepts" description="Need attention across classes" />
            </CardHeader>
            <CardBody>
              {weakConcepts.length > 0 ? (
                <div className="space-y-3">
                  {weakConcepts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{c.concept}</p>
                        <p className="text-2xs text-slate-400">{c.class}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Progress value={c.score} size="sm" variant={c.score < 50 ? 'error' : 'warning'} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-8 text-right">{c.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No weak concepts" description="All concepts are performing well." />
              )}
            </CardBody>
          </Card>

          {/* AI Insights summary */}
          <Card className="border-brand-200 bg-gradient-to-br from-brand-50/50 to-white">
            <CardHeader>
              <SectionTitle title="AI Teaching Insights" action={<Badge variant="brand" dot>AI</Badge>} />
            </CardHeader>
            <CardBody className="space-y-3">
              {highPriorityInsights.map(insight => (
                <div key={insight.id} className="flex gap-3 p-3 rounded-lg bg-white border border-slate-100">
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                    insight.type === 'concept-gap' ? 'bg-error-100 text-error-600' :
                    insight.type === 'student-support' ? 'bg-warning-100 text-warning-600' :
                    'bg-success-100 text-success-600'
                  }`}>
                    {insight.type === 'concept-gap' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                     insight.type === 'student-support' ? <Users className="h-3.5 w-3.5" /> :
                     <Lightbulb className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{insight.title}</p>
                    <p className="text-2xs text-slate-500 mt-0.5 line-clamp-2">{insight.description}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/teacher/insights')}>
                <Sparkles className="h-3.5 w-3.5" /> View All Insights
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
