"use client";

import { useState, useEffect } from 'react';
import { useNavigate } from '@/components/bolt/router';
import { PageHeader, SectionTitle } from '@/components/shared/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TeachingInsight } from '@/types';
import {
  Lightbulb, AlertTriangle, Users, Sparkles,
  ArrowRight, Target, CheckCircle2,
} from 'lucide-react';

const typeConfig: Record<TeachingInsight['type'], { icon: typeof Lightbulb; color: string; bg: string; label: string }> = {
  'concept-gap': { icon: AlertTriangle, color: 'text-error-600', bg: 'bg-error-50', label: 'Concept Gap' },
  'student-support': { icon: Users, color: 'text-warning-600', bg: 'bg-warning-50', label: 'Student Support' },
  'teaching-strategy': { icon: Lightbulb, color: 'text-info-600', bg: 'bg-info-50', label: 'Teaching Strategy' },
  positive: { icon: CheckCircle2, color: 'text-success-600', bg: 'bg-success-50', label: 'Positive' },
};

const priorityConfig: Record<TeachingInsight['priority'], { variant: 'error' | 'warning' | 'default'; label: string }> = {
  high: { variant: 'error', label: 'High Priority' },
  medium: { variant: 'warning', label: 'Medium Priority' },
  low: { variant: 'default', label: 'Low Priority' },
};

export function TeacherInsights() {
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [insights, setInsights] = useState<TeachingInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsHydrated(true);
    let isCancelled = false;

    async function loadInsights() {
      try {
        setLoading(true);
        const res = await fetch('/api/insights/teacher');
        if (!res.ok) throw new Error('Failed to load teaching insights');
        const data = await res.json();
        if (isCancelled) return;
        setInsights(data.insights || []);
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching teaching insights:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      isCancelled = true;
    };
  }, []);

  const activeInsights = isHydrated ? insights : [];
  const high = activeInsights.filter((i) => i.priority === 'high');
  const medium = activeInsights.filter((i) => i.priority === 'medium');
  const low = activeInsights.filter((i) => i.priority === 'low');

  const renderInsight = (insight: TeachingInsight) => {
    const tc = typeConfig[insight.type] || typeConfig['teaching-strategy'];
    const pc = priorityConfig[insight.priority] || priorityConfig['medium'];
    return (
      <Card key={insight.id} className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tc.bg} ${tc.color} flex-shrink-0`}>
              <tc.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={pc.variant} size="sm" dot>{pc.label}</Badge>
                <Badge variant="default" size="sm">{tc.label}</Badge>
                <Badge variant="brand" size="sm"><Sparkles className="h-3 w-3 mr-0.5" /> AI</Badge>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{insight.title}</h3>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-3 leading-relaxed">{insight.description}</p>

          {insight.affectedStudents && insight.affectedStudents.length > 0 && (
            <div className="mb-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Affected Students ({insight.affectedStudents.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insight.affectedStudents.slice(0, 5).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                    {s}
                  </span>
                ))}
                {insight.affectedStudents.length > 5 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-md">
                    +{insight.affectedStudents.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 border border-brand-100">
            <Target className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-brand-600 mb-0.5">
                Recommended Action
              </p>
              <p className="text-sm text-slate-700">{insight.action}</p>
            </div>
          </div>

          {insight.concept && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Related concept: <span className="font-medium text-slate-600">{insight.concept}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/results')}>
                View Analytics <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Teaching Insights"
        description="AI-generated recommendations to improve student learning outcomes."
      />

      <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1">AI Analysis Complete</h2>
            <p className="text-sm text-white/80">
              {activeInsights.length} insights generated from recent assessment data across your classes.
            </p>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-4 mt-5">
          <div className="p-3 rounded-xl bg-white/10">
            <p className="text-2xl font-bold">{high.length}</p>
            <p className="text-xs text-white/70">High Priority</p>
          </div>
          <div className="p-3 rounded-xl bg-white/10">
            <p className="text-2xl font-bold">{medium.length}</p>
            <p className="text-xs text-white/70">Medium Priority</p>
          </div>
          <div className="p-3 rounded-xl bg-white/10">
            <p className="text-2xl font-bold">{low.length}</p>
            <p className="text-xs text-white/70">Low Priority</p>
          </div>
        </div>
      </div>

      {!isHydrated || loading ? (
        <div className="py-24 text-center">
          <div className="w-6 h-6 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Generating AI teaching insights...</p>
        </div>
      ) : activeInsights.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-6 w-6" />}
          title="No insights yet"
          description="Publish assessments and collect results to generate AI insights."
        />
      ) : (
        <>
          {high.length > 0 && (
            <div>
              <SectionTitle title="High Priority" description="Address these issues first" />
              <div className="space-y-3 stagger">{high.map(renderInsight)}</div>
            </div>
          )}
          {medium.length > 0 && (
            <div>
              <SectionTitle title="Medium Priority" description="Plan for these improvements" />
              <div className="space-y-3 stagger">{medium.map(renderInsight)}</div>
            </div>
          )}
          {low.length > 0 && (
            <div>
              <SectionTitle title="Positive Notes" description="What's working well" />
              <div className="space-y-3 stagger">{low.map(renderInsight)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
