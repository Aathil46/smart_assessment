/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Circle, Clock3, FileQuestion, Plus, Save, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { AppShell, AiCallout, Button, Card, PageHeader, Status } from "@/app/components/ui";

type Question = { id: string; text: string; choices: string[]; correct_answer: string; concept: string; difficulty: string; source: string };

export default function EditAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assessment, setAssessment] = useState<any>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [attemptLimit, setAttemptLimit] = useState(1);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [savedId, setSavedId] = useState("");

  useEffect(() => {
    fetch(`/api/assessments/${id}`).then((r) => r.json()).then((data) => setAssessment(data.assessment)).catch(() => setError("Unable to load this assessment."));
  }, [id]);

  const questions = (assessment?.questions ?? []) as Question[];
  const question = questions[selected];
  const locked = assessment?.status !== "draft";
  const reviewedCount = useMemo(() => questions.filter((item) => item.text?.trim() && item.choices?.length === 4 && item.concept?.trim()).length, [questions]);
  const reviewProgress = questions.length ? Math.round((reviewedCount / questions.length) * 100) : 0;

  const update = (changes: Partial<Question>) => {
    if (!assessment || locked) return;
    setSavedId("");
    setAssessment({ ...assessment, questions: questions.map((item, index) => index === selected ? { ...item, ...changes } : item) });
  };

  async function save(current: Question) {
    setSaving(true); setError(""); setSavedId("");
    try {
      const response = await fetch(`/api/questions/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...current, correctAnswer: current.correct_answer }) });
      if (!response.ok) { setError((await response.json())?.error?.message ?? "Unable to save question."); return; }
      setSavedId(current.id);
    } catch { setError("Unable to save question. Please try again."); }
    finally { setSaving(false); }
  }

  async function addManual() {
    if (locked || adding) return;
    setAdding(true); setError("");
    try {
      const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId: id, text: "Manual question", choices: ["A", "B", "C", "D"], correctAnswer: "A", concept: "New concept", difficulty: "medium", source: "manual" }) });
      if (!response.ok) { setError((await response.json())?.error?.message ?? "Unable to add question."); return; }
      const data = await response.json();
      setAssessment({ ...assessment, questions: [...questions, data.question] });
      setSelected(questions.length);
    } catch { setError("Unable to add question. Please try again."); }
    finally { setAdding(false); }
  }

  async function remove(current: Question) {
    if (locked || deleting) return;
    if (!confirm("Delete this question?")) return;
    setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/questions/${current.id}`, { method: "DELETE" });
      if (!response.ok) { setError("Unable to delete question."); return; }
      const next = questions.filter((item) => item.id !== current.id);
      setAssessment({ ...assessment, questions: next });
      setSelected(Math.min(selected, Math.max(0, next.length - 1)));
    } catch { setError("Unable to delete question. Please try again."); }
    finally { setDeleting(false); }
  }

  async function publish() {
    if (publishing || locked) return;
    setPublishing(true); setPublishMessage(""); setError("");
    try {
      const response = await fetch(`/api/assessments/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptLimit, opensAt: opensAt ? new Date(opensAt).toISOString() : null, closesAt: closesAt ? new Date(closesAt).toISOString() : null }) });
      const data = await response.json();
      if (!response.ok) { setError(data?.error?.message ?? "Unable to publish."); return; }
      setAssessment({ ...assessment, status: data.status ?? "published" });
      setPublishMessage("Assessment published successfully.");
    } catch { setError("Unable to publish. Please try again."); }
    finally { setPublishing(false); }
  }

  if (!assessment) return <AppShell role="teacher" active="Assessments"><div className="p-5 sm:p-8 lg:p-10"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-8 w-2/3 rounded bg-slate-200"/><div className="h-4 w-1/2 rounded bg-slate-200"/><div className="grid gap-5 lg:grid-cols-[250px_1fr_280px]"><div className="h-96 rounded-2xl bg-slate-200"/><div className="h-[520px] rounded-2xl bg-slate-200"/><div className="h-72 rounded-2xl bg-slate-200"/></div></div></div></AppShell>;

  return (
    <AppShell role="teacher" active="Assessments">
      <PageHeader
        eyebrow="Assessment Studio"
        title={assessment.title}
        description={`${questions.length} questions · ${assessment.status === "draft" ? "Review and refine before publishing" : "Published assessment"}`}
        action={!locked ? <Button onClick={publish as any} icon={<WandSparkles size={16}/>}>{publishing ? "Publishing…" : "Publish assessment"}</Button> : <Status tone="success"><CheckCircle2 size={14}/> Published</Status>}
      />

      <div className="mx-auto max-w-[1440px] space-y-5 p-5 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-[sa-fade-up_.4s_ease-out_both]">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Link href="/teacher/assessments" className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-[var(--primary)]"><ArrowLeft size={15}/> Assessments</Link><span>/</span><span className="truncate">{assessment.title}</span></div>
          <div className="flex items-center gap-2"><Status tone={locked ? "success" : "neutral"}>{locked ? "Published" : "Draft"}</Status><span className="text-xs text-[var(--muted)]">{reviewedCount}/{questions.length} ready to publish</span></div>
        </div>

        <Card className="overflow-hidden animate-[sa-fade-up_.45s_ease-out_.04s_both]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6"><div><p className="text-sm font-semibold">Review progress</p><p className="mt-1 text-xs text-[var(--muted)]">Make sure every question has a clear concept and four choices.</p></div><span className="text-sm font-semibold text-[var(--primary)]">{reviewProgress}%</span></div>
          <div className="h-1.5 bg-slate-100"><div className="h-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${reviewProgress}%` }}/></div>
        </Card>

        {publishMessage && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 animate-[sa-fade-in_.3s_ease-out]" role="status"><CheckCircle2 size={17}/>{publishMessage}</div>}
        {error && <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-[sa-fade-in_.3s_ease-out]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={17}/><span>{error}</span></div>}

        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_290px]">
          <Card className="h-fit overflow-hidden animate-[sa-fade-up_.45s_ease-out_.08s_both]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4"><div><p className="text-sm font-semibold">Questions</p><p className="mt-0.5 text-xs text-[var(--muted)]">{questions.length} total</p></div><FileQuestion size={18} className="text-[var(--muted-foreground)]"/></div>
            <div className="max-h-[620px] space-y-1.5 overflow-y-auto p-2.5">
              {questions.map((item, index) => <button key={item.id} onClick={() => setSelected(index)} className={`group w-full rounded-xl border p-3 text-left transition-all duration-200 ${index === selected ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm" : "border-transparent hover:border-[var(--border)] hover:bg-slate-50"}`}><div className="flex items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${index === selected ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span className="truncate text-xs font-semibold">{item.concept || "Untitled concept"}</span><span className="ml-auto shrink-0">{item.text?.trim() && item.choices?.length === 4 ? <CheckCircle2 size={14} className="text-[var(--success)]"/> : <Circle size={14} className="text-slate-300"/>}</span></div><div className="mt-2 flex items-center gap-1.5 pl-8 text-[10px] text-[var(--muted)]"><span className="capitalize">{item.difficulty}</span><span>·</span><span className="capitalize">{item.source}</span></div></button>)}
              {!locked && <button onClick={addManual} disabled={adding} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-xs font-semibold text-[var(--primary)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-50"><Plus size={15}/>{adding ? "Adding…" : "Add manual question"}</button>}
            </div>
          </Card>

          {question ? <Card className="overflow-hidden animate-[sa-fade-up_.45s_ease-out_.12s_both]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]">Question {selected + 1}</p><p className="mt-1 text-xs text-[var(--muted)]">Edit the generated content before students see it.</p></div><Status tone={question.source === "manual" ? "neutral" : "ai"}>{question.source === "manual" ? "Manual" : "AI generated"}</Status></div>
            <div className="space-y-7 p-5 sm:p-7">
              <div><label className="text-xs font-semibold text-[var(--foreground)]" htmlFor="question-text">Question prompt</label><textarea id="question-text" disabled={locked} className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[var(--border)] bg-white p-4 text-sm leading-6 outline-none transition-all focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 disabled:bg-slate-50" value={question.text} onChange={(e) => update({ text: e.target.value })}/></div>
              <div><div className="flex items-center justify-between"><label className="text-xs font-semibold">Answer choices</label><span className="text-[11px] text-[var(--muted)]">Select the correct answer</span></div><div className="mt-2 space-y-2.5">{question.choices.map((choice, index) => <div key={index} className={`flex items-center gap-3 rounded-xl border p-2 transition-all duration-200 ${question.correct_answer === choice ? "border-emerald-200 bg-emerald-50/60" : "border-[var(--border)]"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">{String.fromCharCode(65 + index)}</span><input aria-label={`Answer choice ${String.fromCharCode(65 + index)}`} disabled={locked} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" value={choice} onChange={(e) => update({ choices: question.choices.map((value, c) => c === index ? e.target.value : value) })}/><label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600"><input disabled={locked} type="radio" name={`correct-${question.id}`} checked={question.correct_answer === choice} onChange={() => update({ correct_answer: choice })} className="accent-[var(--primary)]"/> Correct</label></div>)}</div></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Concept<input disabled={locked} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10" value={question.concept} onChange={(e) => update({ concept: e.target.value })}/></label><label className="text-xs font-semibold">Difficulty<select disabled={locked} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm capitalize outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10" value={question.difficulty} onChange={(e) => update({ difficulty: e.target.value })}><option>easy</option><option>medium</option><option>hard</option></select></label></div>
              {!locked && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5"><button onClick={() => remove(question)} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--error)] transition hover:bg-[var(--error-soft)] disabled:opacity-50"><Trash2 size={15}/>{deleting ? "Deleting…" : "Delete question"}</button><div className="flex items-center gap-3">{savedId === question.id && <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--success)]"><Check size={14}/> Saved</span>}<Button onClick={save as any} icon={<Save size={15}/>} variant="primary">{saving ? "Saving…" : "Save question"}</Button></div></div>}
            </div>
          </Card> : <Card className="grid min-h-[420px] place-items-center p-8 text-center"><div><FileQuestion className="mx-auto text-slate-300" size={42}/><p className="mt-4 font-semibold">No questions yet</p><p className="mt-1 text-sm text-[var(--muted)]">Add a manual question to start building the assessment.</p></div></Card>}

          <div className="space-y-5 animate-[sa-fade-up_.45s_ease-out_.16s_both]">
            <AiCallout title="AI review guidance">Generated questions are editable. Check that the wording is clear, the correct answer is unambiguous, and the concept matches what you taught.</AiCallout>
            {!locked && <Card className="p-5"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><Clock3 size={16}/></div><div><p className="text-sm font-semibold">Publishing settings</p><p className="text-xs text-[var(--muted)]">Control when students can access it.</p></div></div><div className="mt-5 space-y-4"><label className="block text-xs font-semibold">Opens at<input type="datetime-local" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] px-3 text-xs outline-none focus:border-[var(--primary)]" value={opensAt} onChange={(e) => setOpensAt(e.target.value)}/></label><label className="block text-xs font-semibold">Closes at<input type="datetime-local" className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] px-3 text-xs outline-none focus:border-[var(--primary)]" value={closesAt} onChange={(e) => setClosesAt(e.target.value)}/></label><label className="block text-xs font-semibold">Attempt limit<input type="number" min={1} max={10} className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]" value={attemptLimit} onChange={(e) => setAttemptLimit(Number(e.target.value))}/></label></div></Card>}
            <Card className="p-5"><p className="text-sm font-semibold">Before you publish</p><div className="mt-4 space-y-3">{[[reviewedCount === questions.length, "All questions are complete"],[questions.length > 0, "At least one question exists"],[questions.every((item) => item.choices?.includes(item.correct_answer)), "Each question has a valid correct answer"]].map(([ok, label], index) => <div key={index} className="flex items-center gap-2 text-xs"><span className={ok ? "text-[var(--success)]" : "text-slate-300"}>{ok ? <CheckCircle2 size={15}/> : <Circle size={15}/>}</span><span className={ok ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{label as string}</span></div>)}</div></Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
