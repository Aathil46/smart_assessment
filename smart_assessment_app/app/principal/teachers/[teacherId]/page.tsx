"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiCallout, AppShell, Button, Card, Metric, PageHeader, Status } from "@/app/components/ui";

type Assessment = {
  id: string;
  title: string;
  topic?: string | null;
  grade?: string | number | null;
  subject?: string | null;
};

type TeacherData = {
  teacherName: string;
  assessments: Assessment[];
};

export default function PrincipalTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = use(params);
  const [data, setData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch(`/api/principal/teachers/${teacherId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load this teacher's assessments.");
        return res.json();
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load teacher analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teacherId]);

  const subjects = useMemo(() => {
    if (!data) return 0;
    return new Set(data.assessments.map((item) => item.subject).filter(Boolean)).size;
  }, [data]);

  const grades = useMemo(() => {
    if (!data) return 0;
    return new Set(data.assessments.map((item) => item.grade).filter((item) => item !== null && item !== undefined)).size;
  }, [data]);

  if (loading) {
    return (
      <AppShell role="principal">
        <div className="space-y-6">
          <div className="sa-skeleton h-5 w-32 rounded" />
          <div className="sa-skeleton h-12 w-1/2 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="sa-skeleton h-28 rounded-2xl" />)}
          </div>
          <div className="sa-skeleton h-72 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell role="principal">
        <Card className="mx-auto max-w-xl p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Teacher analytics unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{error ?? "We could not load this teacher."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Link href="/principal" className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-muted)]">Back to overview</Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role="principal">
      <div className="space-y-8">
        <Link href="/principal" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]">
          <span aria-hidden="true">←</span> School overview
        </Link>

        <PageHeader
          eyebrow="Teacher workspace"
          title={data.teacherName}
          description="Published assessment activity for this teacher, organized for quick school-level review."
          action={<Button variant="secondary" onClick={() => router.back()}>Back</Button>}
        />

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Teacher metrics">
          <Metric label="Assessments" value={data.assessments.length} detail="Published assessment records" />
          <Metric label="Subjects" value={subjects} detail="Distinct subjects represented" />
          <Metric label="Grades" value={grades} detail="Distinct grades represented" />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Assessment portfolio</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Published assessments</h2>
              </div>
              <Status tone="neutral">{data.assessments.length} total</Status>
            </div>

            {data.assessments.length === 0 ? (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel-muted)] text-[var(--muted)]">—</div>
                <p className="mt-4 font-semibold text-[var(--foreground)]">No published assessments</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">Published assessment activity for this teacher will appear here when available.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {data.assessments.map((assessment, index) => (
                  <Link
                    key={assessment.id}
                    href={`/principal/assessments/${assessment.id}`}
                    className="group flex flex-col gap-4 py-5 transition duration-200 hover:bg-[var(--panel-muted)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary)]">{index + 1}</span>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">{assessment.title}</h3>
                          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{assessment.topic || "General topic"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-12 sm:pl-0">
                      {assessment.grade !== null && assessment.grade !== undefined ? <Status tone="neutral">Grade {assessment.grade}</Status> : null}
                      {assessment.subject ? <Status tone="neutral">{assessment.subject}</Status> : null}
                      <span aria-hidden="true" className="ml-1 text-lg text-[var(--muted-foreground)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <AiCallout title="Review focus" eyebrow="Principal view">
            <p className="text-sm leading-6 text-[var(--muted)]">
              Use individual assessment analytics to inspect participation, pass rates, and concept-level learning signals without changing the teacher's workflow.
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2"><span className="text-[var(--muted)]">Portfolio size</span><span className="font-semibold text-[var(--foreground)]">{data.assessments.length}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2"><span className="text-[var(--muted)]">Subjects</span><span className="font-semibold text-[var(--foreground)]">{subjects}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2"><span className="text-[var(--muted)]">Grades</span><span className="font-semibold text-[var(--foreground)]">{grades}</span></div>
            </div>
          </AiCallout>
        </section>
      </div>
    </AppShell>
  );
}
