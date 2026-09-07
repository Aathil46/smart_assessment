"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Sparkles, Target, Trophy } from "lucide-react";

import { AppShell, Card, PageHeader, ProgressBar, Status } from "@/app/components/ui";

type ConceptPerf = { concept: string; correctCount: number; totalCount: number; accuracy: number; accuracyPercentage: number; level: "Strong" | "Medium" | "Weak" };
type LearningGap = { concept: string; gap_level: string; notes: string | null; recommendations: string[] };
type AttemptInfo = { id: string; assessment_id: string; score: number; total: number; percentage: number; passFail: "Pass" | "Fail"; isWeakStudent: boolean; submitted_at: string | null; started_at: string };
type ResultData = { status?: string; message?: string; attempt: AttemptInfo; assessment: { title: string; topic: string | null } | null; conceptPerformance: ConceptPerf[]; gaps: LearningGap[]; error?: { code: string; message: string } };

const levelTone = { Strong: "success", Medium: "warning", Weak: "error" } as const;

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/results/student/${id}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message ?? "Unable to load result."); return d; })
      .then((d) => d.error ? setError(d.error.message ?? "Unable to load result.") : setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="min-h-screen bg-[var(--background)] px-5 py-10"><div className="mx-auto max-w-6xl space-y-6"><div className="h-7 w-40 animate-pulse rounded bg-slate-200"/><div className="h-52 animate-pulse rounded-3xl bg-white"/><div className="h-64 animate-pulse rounded-3xl bg-white"/></div></main>;

  if (error || !data) return <main className="min-h-screen bg-[var(--background)] px-5 py-16"><div className="mx-auto max-w-lg rounded-3xl border border-[var(--error)]/20 bg-white p-8 text-center shadow-sm"><CircleAlert className="mx-auto text-[var(--error)]" size={36}/><h1 className="mt-4 text-xl font-semibold">Unable to load result</h1><p className="mt-2 text-sm text-[var(--muted)]">{error ?? "Please try again."}</p><Link href="/student" className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white">Back to dashboard</Link></div></main>;

  if (data.status === "in_progress" || !data.attempt.submitted_at) return <AppShell role="student"><div className="mx-auto max-w-2xl"><Card className="sa-fade-up p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]"><CircleAlert size={24}/></div><h1 className="mt-5 text-2xl font-semibold">Assessment in progress</h1><p className="mt-2 text-sm text-[var(--muted)]">{data.message ?? "This assessment has not been submitted yet."}</p><Link href="/student" className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white">Back to dashboard</Link></Card></div></AppShell>;

  const { attempt, assessment, conceptPerformance, gaps } = data;
  const passed = attempt.passFail === "Pass";
  const strongCount = conceptPerformance.filter((c) => c.level === "Strong").length;
  const weakCount = conceptPerformance.filter((c) => c.level === "Weak").length;
  const avgConcept = useMemo(() => conceptPerformance.length ? Math.round(conceptPerformance.reduce((sum, c) => sum + c.accuracyPercentage, 0) / conceptPerformance.length) : attempt.percentage, [conceptPerformance, attempt.percentage]);

  return <AppShell role="student">
    <div className="space-y-7">
      <Link href="/student" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"><ArrowLeft size={16}/> Back to dashboard</Link>

      <PageHeader eyebrow="Assessment result" title={assessment?.title ?? "Assessment result"} description={assessment?.topic ?? "Here is a breakdown of your understanding by concept."} />

      <section className={`sa-fade-up overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-8 ${passed ? "border-[var(--success)]/20 bg-[var(--success-soft)]" : "border-[var(--error)]/20 bg-[var(--error-soft)]"}`}>
        <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl bg-white ${passed ? "text-[var(--success)]" : "text-[var(--error)]"}`}>{passed ? <Trophy size={22}/> : <Target size={22}/>}</div><Status tone={passed ? "success" : "error"}>{attempt.passFail}</Status></div><p className="mt-6 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Your score</p><div className="mt-1 flex items-baseline gap-2"><span className="text-5xl font-bold tracking-[-.04em] tabular-nums">{attempt.percentage}%</span><span className="text-sm text-[var(--muted)]">{attempt.score} of {attempt.total} correct</span></div></div>
          <div className="grid grid-cols-3 gap-3 md:w-[360px]"><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-[var(--muted)]">Concepts</p><p className="mt-1 text-xl font-bold">{conceptPerformance.length}</p></div><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-[var(--muted)]">Strong</p><p className="mt-1 text-xl font-bold text-[var(--success)]">{strongCount}</p></div><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs text-[var(--muted)]">Needs work</p><p className="mt-1 text-xl font-bold text-[var(--error)]">{weakCount}</p></div></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="sa-fade-up sa-delay-1 p-6 sm:p-7"><div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Concept performance</h2><p className="mt-1 text-sm text-[var(--muted)]">See where your understanding is strong and where to focus next.</p></div><span className="text-sm font-semibold text-[var(--primary)]">{avgConcept}% avg.</span></div><div className="mt-6 space-y-5">{conceptPerformance.map((cp) => <div key={cp.concept}><div className="mb-2 flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{cp.concept}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{cp.correctCount} / {cp.totalCount} correct</p></div><Status tone={levelTone[cp.level]}>{cp.level}</Status></div><ProgressBar value={cp.accuracyPercentage}/></div>)}</div></Card>

        <div className="space-y-6"><Card className="sa-fade-up sa-delay-2 p-6"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ai-soft)] text-[var(--ai)]"><Sparkles size={18}/></div><h2 className="font-semibold">Learning signal</h2></div><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{gaps.length ? `You have ${gaps.length} concept${gaps.length === 1 ? "" : "s"} worth revisiting. Start with the weakest area, then retest yourself.` : "You showed solid understanding across the assessed concepts. Keep practicing to retain it."}</p></Card><Card className="sa-fade-up sa-delay-3 p-6"><h2 className="font-semibold">What this means</h2><div className="mt-4 space-y-3 text-sm text-[var(--muted)]"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-[var(--success)]" size={17}/><p>Strong concepts are areas you can confidently build on.</p></div><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 shrink-0 text-[var(--warning)]" size={17}/><p>Medium concepts may benefit from a quick review.</p></div><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 shrink-0 text-[var(--error)]" size={17}/><p>Weak concepts should be your first practice priority.</p></div></div></Card></div>
      </div>

      {gaps.length > 0 ? <Card className="sa-fade-up sa-delay-4 p-6 sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">Learning gaps</h2><p className="mt-1 text-sm text-[var(--muted)]">Priorities generated from your assessment performance.</p></div><Status tone="error">{gaps.length} to review</Status></div><div className="mt-6 grid gap-4 md:grid-cols-2">{gaps.map((gap) => <article key={gap.concept} className="rounded-2xl border border-[var(--error)]/15 bg-[var(--error-soft)]/45 p-5 transition duration-200 hover:-translate-y-0.5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{gap.concept}</h3>{gap.notes && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{gap.notes}</p>}</div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--error)]">{gap.gap_level}</span></div>{gap.recommendations?.length > 0 && <div className="mt-4 border-t border-[var(--error)]/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Recommended next steps</p><ul className="mt-2 space-y-2">{gap.recommendations.slice(0, 3).map((r, i) => <li key={i} className="flex gap-2 text-sm leading-5 text-[var(--muted)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]"/>{r}</li>)}</ul></div>}</article>)}</div></Card> : <Card className="sa-fade-up sa-delay-4 border-[var(--success)]/20 bg-[var(--success-soft)]/50 p-7 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--success)]"><CheckCircle2 size={24}/></div><h2 className="mt-4 text-lg font-semibold">No learning gaps detected</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Great work. You demonstrated solid understanding across the concepts assessed here.</p></Card>}

      <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-between"><Link href="/student" className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold transition hover:bg-slate-50">Back to dashboard</Link>{gaps.length > 0 && <Link href="/student/gaps" className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)]">Review learning gaps</Link>}</div>
    </div>
  </AppShell>;
}
