"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell, Button, Card, Metric, PageHeader, Status } from "@/app/components/ui";

type Teacher = { id: string; name: string; subjects: string[] };

export default function PrincipalGradePage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = use(params);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch(`/api/principal/grades/${grade}`)
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load this grade.");
        return res.json();
      })
      .then((result) => { if (active) setTeachers(result.teachers ?? []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load grade analytics."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [grade]);

  const subjectCount = useMemo(() => new Set((teachers ?? []).flatMap((teacher) => teacher.subjects)).size, [teachers]);

  if (loading) {
    return <AppShell role="principal"><div className="space-y-6"><div className="sa-skeleton h-5 w-28 rounded"/><div className="sa-skeleton h-12 w-1/2 rounded-xl"/><div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map((i)=><div key={i} className="sa-skeleton h-28 rounded-2xl"/>)}</div><div className="sa-skeleton h-72 rounded-2xl"/></div></AppShell>;
  }

  if (error || !teachers) {
    return <AppShell role="principal"><Card className="mx-auto max-w-xl p-8 text-center"><h1 className="text-lg font-semibold text-[var(--foreground)]">Grade analytics unavailable</h1><p className="mt-2 text-sm text-[var(--muted)]">{error ?? "We could not load this grade."}</p><div className="mt-6 flex justify-center gap-3"><Button onClick={() => window.location.reload()}>Try again</Button><Link href="/principal" className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-muted)]">Back to school</Link></div></Card></AppShell>;
  }

  return (
    <AppShell role="principal">
      <div className="space-y-8">
        <Link href="/principal" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"><span aria-hidden="true">←</span> School overview</Link>
        <PageHeader eyebrow={`Grade ${grade}`} title="Teachers & subjects" description="Review the teaching coverage for this grade and open a teacher portfolio for assessment activity." action={<Button variant="secondary" onClick={() => router.back()}>Back</Button>} />

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Grade metrics">
          <Metric label="Teachers" value={teachers.length} detail="Teachers assigned to this grade" />
          <Metric label="Subjects" value={subjectCount} detail="Distinct subjects represented" />
          <Metric label="Coverage" value={teachers.length ? "Active" : "None"} detail="Teaching roster status" tone={teachers.length ? "success" : "danger"} />
        </section>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Teaching roster</p>
            <div className="mt-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><h2 className="text-lg font-semibold text-[var(--foreground)]">Grade {grade} faculty</h2><Status tone="neutral">{teachers.length} teacher{teachers.length === 1 ? "" : "s"}</Status></div>
          </div>
          {teachers.length === 0 ? (
            <div className="px-6 py-14 text-center"><p className="font-semibold text-[var(--foreground)]">No teachers found</p><p className="mt-1 text-sm text-[var(--muted)]">There is no teaching roster available for Grade {grade} yet.</p></div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {teachers.map((teacher, index) => (
                <Link key={teacher.id} href={`/principal/teachers/${teacher.id}`} className="group rounded-xl border border-[var(--border)] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-muted)] text-sm font-bold text-[var(--primary)] group-hover:bg-white">{teacher.name.trim().split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase()}</div><span className="text-lg text-[var(--muted-foreground)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]">→</span></div>
                  <h3 className="mt-5 font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">{teacher.name}</h3>
                  <div className="mt-3 flex min-h-7 flex-wrap gap-2">{teacher.subjects.length ? teacher.subjects.map((subject) => <Status key={subject} tone="neutral">{subject}</Status>) : <span className="text-sm text-[var(--muted-foreground)]">No subjects listed</span>}</div>
                  <p className="mt-5 text-xs font-medium text-[var(--muted)]">Open assessment portfolio · {index + 1}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
