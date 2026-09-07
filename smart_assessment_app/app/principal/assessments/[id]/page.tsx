"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AiCallout,
  AppShell,
  Button,
  Card,
  Metric,
  PageHeader,
  ProgressBar,
  Status,
} from "@/app/components/ui";

type Concept = {
  concept: string;
  accuracyPercentage: number;
  level: string;
};

type ResultsData = {
  assessment: {
    class_name: string;
    teacher_name: string;
    title: string;
  };
  overview: {
    totalStudents: number;
    completed: number;
    passed: number;
    failed: number;
  };
  weakConcepts: Concept[];
  mediumConcepts: Concept[];
};

export default function PrincipalAssessmentResults({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch(`/api/principal/assessments/${id}/results`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch assessment analytics.");
        return res.json();
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const completionRate = useMemo(() => {
    if (!data?.overview.totalStudents) return 0;
    return Math.round((data.overview.completed / data.overview.totalStudents) * 100);
  }, [data]);

  const passRate = useMemo(() => {
    if (!data?.overview.completed) return 0;
    return Math.round((data.overview.passed / data.overview.completed) * 100);
  }, [data]);

  const generateReview = async () => {
    if (!data) return;
    setGeneratingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/principal/assessments/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passed: data.overview.passed,
          failed: data.overview.failed,
          weakConcepts: data.weakConcepts.map((concept) => concept.concept),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error?.message ?? "Unable to generate AI review.");
      if (!result.review) throw new Error("AI review generation returned no review.");
      setAiReview(result.review);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Unable to generate AI review.");
    } finally {
      setGeneratingReview(false);
    }
  };

  if (loading) {
    return (
      <AppShell role="principal">
        <div className="space-y-6">
          <div className="sa-skeleton h-5 w-28 rounded" />
          <div className="sa-skeleton h-12 w-2/3 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="sa-skeleton h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="sa-skeleton h-96 rounded-2xl lg:col-span-2" />
            <div className="sa-skeleton h-80 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell role="principal">
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--error-soft)] text-[var(--error)]">!</div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Analytics unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{error ?? "We could not load this assessment."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Link href="/principal/assessments" className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-muted)]">Back to assessments</Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const { overview } = data;
  const conceptCount = data.weakConcepts.length + data.mediumConcepts.length;

  return (
    <AppShell role="principal">
      <div className="space-y-8">
        <Link href="/principal/assessments" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <span aria-hidden="true">←</span> Assessment portfolio
        </Link>

        <PageHeader
          eyebrow={`${data.assessment.class_name} · ${data.assessment.teacher_name}`}
          title={data.assessment.title}
          description="School-level view of participation, outcomes, and concepts that may need instructional attention."
          action={
            <Button variant="secondary" onClick={() => router.back()}>
              Back
            </Button>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Assessment metrics">
          <Metric label="Students" value={overview.totalStudents} detail="Enrolled in class" />
          <Metric label="Completed" value={overview.completed} detail={`${completionRate}% participation`} />
          <Metric label="Passed" value={overview.passed} detail={`${passRate}% of completed`} tone="success" />
          <Metric label="Failed" value={overview.failed} detail={overview.completed ? `${100 - passRate}% of completed` : "No completed attempts"} tone="danger" />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="sa-fade-up p-6 lg:col-span-2">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Participation</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Assessment reach</h2>
              </div>
              <Status tone={completionRate >= 80 ? "success" : completionRate >= 50 ? "warning" : "danger"}>
                {completionRate}% complete
              </Status>
            </div>
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Completed attempts</span>
                <span className="font-semibold text-[var(--foreground)]">{overview.completed} / {overview.totalStudents}</span>
              </div>
              <ProgressBar value={completionRate} tone="primary" />
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--success-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--success)]">Outcome</p>
                <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{passRate}%</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Pass rate among completed attempts</p>
              </div>
              <div className="rounded-xl bg-[var(--warning-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--warning)]">Concept signals</p>
                <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{conceptCount}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Weak or medium concepts detected</p>
              </div>
            </div>
          </Card>

          <AiCallout title="School insight" eyebrow="AI-assisted review">
            {aiReview ? (
              <div className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{aiReview}</p>
                <Button variant="secondary" onClick={generateReview} disabled={generatingReview}>
                  {generatingReview ? "Refreshing…" : "Refresh review"}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm leading-6 text-[var(--muted)]">Generate a concise instructional summary from aggregated assessment outcomes and weak concepts.</p>
                {reviewError ? <p role="alert" className="mt-3 rounded-lg bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{reviewError}</p> : null}
                <Button className="mt-4" onClick={generateReview} disabled={generatingReview}>
                  {generatingReview ? "Generating…" : "Generate AI review"}
                </Button>
              </>
            )}
          </AiCallout>
        </section>

        <section className="space-y-4 sa-fade-up sa-delay-1">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Learning signals</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Concept analytics</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Prioritize concepts with the lowest accuracy before reviewing broader school trends.</p>
            </div>
          </div>

          {conceptCount === 0 ? (
            <Card className="p-8 text-center">
              <p className="font-semibold text-[var(--foreground)]">No attention signals yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">There are no weak or medium concepts in the aggregated results for this assessment.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[...data.weakConcepts, ...data.mediumConcepts]
                .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage)
                .map((concept, index) => {
                  const weak = data.weakConcepts.some((item) => item.concept === concept.concept);
                  return (
                    <Card key={`${concept.concept}-${index}`} className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--foreground)]">{concept.concept}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">Aggregated concept accuracy</p>
                        </div>
                        <Status tone={weak ? "danger" : "warning"}>{concept.level}</Status>
                      </div>
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-[var(--muted)]">Accuracy</span>
                          <span className="font-bold text-[var(--foreground)]">{concept.accuracyPercentage}%</span>
                        </div>
                        <ProgressBar value={concept.accuracyPercentage} tone={weak ? "danger" : "warning"} />
                      </div>
                      {weak ? <p className="mt-4 text-xs font-medium text-[var(--error)]">Priority reteaching signal</p> : <p className="mt-4 text-xs font-medium text-[var(--warning)]">Monitor this concept</p>}
                    </Card>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
