/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, Send, Sparkles } from "lucide-react";

export default function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>();
  const [index, setIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId: id }) })
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) throw new Error(payload?.error?.message ?? "Unable to load the assessment.");
        return payload;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const questions = data?.questions ?? [];
  const question = questions[index];
  const answeredCount = useMemo(() => Object.keys(selectedAnswers).length, [selectedAnswers]);
  const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0;

  async function answer(value: string) {
    if (!question || saving || submitting) return;
    setSelectedAnswers((current) => ({ ...current, [question.id]: value }));
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/attempts/${data.attempt.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, selectedChoice: value }) });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error?.message ?? "Unable to save this answer.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/attempts/${data.attempt.id}/submit`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Unable to submit.");
      router.push(`/student/results/${data.attempt.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (!data?.questions) {
    return <main className="min-h-screen bg-[var(--background)] px-5 py-10"><div className="mx-auto max-w-3xl"><div className="h-4 w-28 animate-pulse rounded bg-slate-200"/><div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-8 shadow-sm"><div className="h-5 w-32 animate-pulse rounded bg-slate-100"/><div className="mt-6 h-24 animate-pulse rounded-xl bg-slate-100"/><div className="mt-6 space-y-3">{[1,2,3,4].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100"/>)}</div></div></div></main>;
  }

  if (!question) return <main className="p-8 text-center">No questions available.</main>;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/student" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"><ArrowLeft size={16}/> Exit</Link>
            <div className="text-center"><p className="text-sm font-semibold text-[var(--foreground)]">Assessment</p><p className="text-xs text-[var(--muted)]">Question {index + 1} of {questions.length}</p></div>
            <div className="hidden items-center gap-2 rounded-full bg-[var(--panel-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] sm:flex"><Clock3 size={14}/> Take your time</div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="sa-progress h-full rounded-full bg-[var(--primary)]" style={{ width: `${progress}%` }}/></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_250px]">
        <section className="sa-fade-up rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_12px_40px_rgba(16,35,63,.05)] sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]"><span className="grid h-5 w-5 place-items-center rounded-full bg-white">{index + 1}</span> Question</span>
            {saving ? <span className="text-xs text-[var(--muted)]">Saving…</span> : selectedAnswers[question.id] ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]"><Check size={14}/> Answer saved</span> : <span className="text-xs text-[var(--muted-foreground)]">Select one answer</span>}
          </div>
          <h1 className="mt-7 text-2xl font-semibold leading-9 tracking-[-.025em] text-[var(--foreground)] sm:text-[28px]">{question.text}</h1>
          <div className="mt-8 grid gap-3">
            {question.choices.map((choice: string, choiceIndex: number) => {
              const isSelected = selectedAnswers[question.id] === choice;
              return <button key={choice} onClick={() => answer(choice)} disabled={saving || submitting} aria-pressed={isSelected} className={`group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-wait disabled:opacity-70 ${isSelected ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm" : "border-[var(--border)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-semibold transition ${isSelected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--muted)] group-hover:border-[var(--primary)] group-hover:text-[var(--primary)]"}`}>{String.fromCharCode(65 + choiceIndex)}</span><span className="pt-1 text-sm font-medium leading-6 text-[var(--foreground)]">{choice}</span>{isSelected && <Check size={18} className="ml-auto mt-1 shrink-0 text-[var(--primary)]"/>}</button>;
            })}
          </div>

          {error && <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--error)]/20 bg-[var(--error-soft)] p-4 text-sm text-[var(--error)]"><CircleAlert size={18} className="mt-0.5 shrink-0"/><p>{error}</p></div>}

          <div className="mt-9 flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button disabled={index === 0 || saving || submitting} onClick={() => setIndex((value) => value - 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-slate-50 disabled:opacity-40"><ArrowLeft size={16}/> Back</button>
            {index + 1 === questions.length ? <button disabled={submitting || saving || !selectedAnswers[question.id]} onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45">{submitting ? "Submitting…" : "Submit assessment"}<Send size={16}/></button> : <button disabled={saving} onClick={() => setIndex((value) => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] hover:shadow-md disabled:opacity-50">Next question <ArrowRight size={16}/></button>}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Your progress</p><span className="text-xs font-semibold text-[var(--primary)]">{answeredCount}/{questions.length}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}/></div>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Answers are saved as you go. You can move back and review before submitting.</p>
          </section>
          <section className="rounded-2xl border border-[#ded5ff] bg-[var(--ai-soft)] p-5 transition-transform duration-200 hover:-translate-y-0.5"><div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--ai)]"><Sparkles size={17}/></div><div><p className="text-sm font-semibold">Think it through</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Read every option before choosing. Your result helps identify what to practice next.</p></div></div></section>
          <div className="grid grid-cols-5 gap-2 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-6 lg:grid-cols-5">{questions.map((item: any, itemIndex: number) => { const done = Boolean(selectedAnswers[item.id]); return <button key={item.id} onClick={() => setIndex(itemIndex)} aria-label={`Go to question ${itemIndex + 1}`} className={`grid h-9 place-items-center rounded-lg text-xs font-semibold transition-all duration-150 ${itemIndex === index ? "bg-[var(--primary)] text-white shadow-sm" : done ? "bg-[var(--success-soft)] text-[var(--success)] hover:-translate-y-0.5" : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200"}`}>{done && itemIndex !== index ? <Check size={14}/> : itemIndex + 1}</button>; })}</div>
        </aside>
      </div>
    </main>
  );
}
