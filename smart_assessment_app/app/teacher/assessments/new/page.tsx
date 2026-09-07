"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import { AppShell, Button, Card, PageHeader, Status } from "@/app/components/ui";

type ClassOption = { id: string; name: string; grade?: string | null };
type MaterialOption = { id: string; title: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function NewAssessmentPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [form, setForm] = useState({ classId: "", materialId: "", title: "", topic: "", numQuestions: 10, difficulty: "medium" });
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [error, setError] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const classId = new URLSearchParams(window.location.search).get("classId");
    if (classId && !UUID_PATTERN.test(classId)) { setError("The selected class link is invalid. Please choose a class again."); setLoadingClasses(false); return; }
    fetch("/api/classes").then((response) => { if (!response.ok) throw new Error("Unable to load your classes."); return response.json(); }).then((data) => {
      const availableClasses = (data.classes ?? []) as ClassOption[];
      setClasses(availableClasses);
      const matchingClass = classId ? availableClasses.find((item) => item.id === classId) : null;
      if (classId && !matchingClass) { setError("That class was not found or is not available to you. Please choose another class."); return; }
      if (matchingClass) { setSelectedClass(matchingClass); setForm((current) => ({ ...current, classId: matchingClass.id })); }
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load your classes.")).finally(() => setLoadingClasses(false));
  }, []);

  useEffect(() => {
    if (!form.classId) { setMaterials([]); return; }
    setLoadingMaterials(true);
    fetch(`/api/materials?classId=${encodeURIComponent(form.classId)}`).then((response) => response.json()).then((data) => setMaterials(data.materials ?? [])).catch(() => setError("Unable to load materials for this class.")).finally(() => setLoadingMaterials(false));
  }, [form.classId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!form.classId || !UUID_PATTERN.test(form.classId) || !selectedClass) { setError("Please select a valid class before creating the assessment."); return; }
    if (!form.materialId) { setError("Select a processed learning material first."); return; }
    setGenerating(true);
    try {
      const response = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, classId: form.classId }) });
      const data = await response.json();
      if (!response.ok) { setError(data?.error?.message ?? "Unable to create assessment."); return; }
      const generated = await fetch(`/api/assessments/${data.id}/generate`, { method: "POST" });
      if (!generated.ok) { const failure = await generated.json(); setError(failure?.error?.message ?? "Generation failed."); return; }
      router.push(`/teacher/assessments/${data.id}/edit`);
    } catch { setError("Something went wrong while generating the assessment."); } finally { setGenerating(false); }
  }

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId) ?? null;
    setSelectedClass(nextClass); setForm((current) => ({ ...current, classId, materialId: "" })); setError(nextClass ? "" : "Please select a valid class.");
  }

  return <AppShell role="teacher" active="Assessments">
    <PageHeader eyebrow="Assessment studio" title="Create an assessment" description="Choose a class and learning material, then let AI prepare a concept-aware draft for your review." action={<Button href="/teacher/assessments" variant="secondary" icon={<ArrowLeft size={16}/>}>Back</Button>} />
    <div className="mx-auto max-w-[1100px] px-5 py-7 sm:px-8 lg:px-10">
      <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="sa-fade-up rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] p-4"><div className="flex items-center gap-2 text-[var(--primary)]"><BookOpen size={16}/><span className="text-xs font-semibold">1 · Context</span></div><p className="mt-2 text-sm font-medium">Choose your class & material</p></div><div className="sa-fade-up sa-delay-1 rounded-2xl border border-[var(--border)] bg-white p-4"><div className="flex items-center gap-2 text-[var(--muted)]"><BrainCircuit size={16}/><span className="text-xs font-semibold">2 · Generate</span></div><p className="mt-2 text-sm font-medium">AI drafts the questions</p></div><div className="sa-fade-up sa-delay-2 rounded-2xl border border-[var(--border)] bg-white p-4"><div className="flex items-center gap-2 text-[var(--muted)]"><CheckCircle2 size={16}/><span className="text-xs font-semibold">3 · Review</span></div><p className="mt-2 text-sm font-medium">Edit, verify, and publish</p></div></div>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="sa-fade-up p-6 sm:p-7"><div className="flex items-center gap-3 border-b border-[var(--border)] pb-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Sparkles size={18}/></div><div><h2 className="font-semibold">Assessment setup</h2><p className="text-xs text-[var(--muted)]">Tell the generator what students should learn.</p></div></div><div className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-semibold" htmlFor="class">Class</label>{selectedClass ? <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] p-3"><div><p className="text-sm font-semibold">{selectedClass.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{selectedClass.grade ? `Grade ${selectedClass.grade}` : "Classroom"}</p></div><Status tone="success">Selected</Status></div> : <select id="class" className="w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" value={form.classId} onChange={(event) => chooseClass(event.target.value)} required disabled={loadingClasses}><option value="">{loadingClasses ? "Loading classes…" : "Select a class"}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? ` · Grade ${item.grade}` : ""}</option>)}</select>}</div><div><label className="mb-2 block text-sm font-semibold" htmlFor="material">Learning material</label><div className="relative"><FileText className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted-foreground)]" size={16}/><select id="material" className="w-full appearance-none rounded-xl border border-[var(--border)] bg-white p-3 pl-10 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" value={form.materialId} onChange={(event) => setForm({ ...form, materialId: event.target.value })} required disabled={!selectedClass || loadingMaterials}><option value="">{loadingMaterials ? "Loading materials…" : materials.length ? "Select processed material" : "No processed materials found"}</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold" htmlFor="title">Assessment title</label><input id="title" className="w-full rounded-xl border border-[var(--border)] p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" placeholder="e.g. Photosynthesis — Unit 3" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="topic">Topic</label><input id="topic" className="w-full rounded-xl border border-[var(--border)] p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" placeholder="e.g. Photosynthesis" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required /></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold" htmlFor="questions">Number of questions</label><input id="questions" className="w-full rounded-xl border border-[var(--border)] p-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" type="number" min={3} max={20} value={form.numQuestions} onChange={(event) => setForm({ ...form, numQuestions: Number(event.target.value) })} /></div><div><label className="mb-2 block text-sm font-semibold" htmlFor="difficulty">Difficulty</label><select id="difficulty" className="w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option>easy</option><option>medium</option><option>hard</option></select></div></div>{error && <div role="alert" className="rounded-xl border border-[var(--error)]/20 bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{error}</div>}<div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end"><Button href={selectedClass ? `/teacher/classes/${selectedClass.id}` : "/teacher/classes"} variant="secondary">Cancel</Button><button disabled={loadingClasses || loadingMaterials || generating || !selectedClass || !form.materialId} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">{generating ? <><Loader2 size={16} className="animate-spin"/> Generating draft…</> : <>Generate draft questions <ArrowRight size={16}/></>}</button></div></div></Card>
        <div className="sa-fade-up sa-delay-2 space-y-4"><Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--ai)]">AI assistance</p><h3 className="mt-3 font-semibold">Review before students see it</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">The generator creates a draft. You stay in control of question wording, answers, concepts, and publishing.</p><div className="mt-4 space-y-2 text-xs text-[var(--muted)]"><p>✓ Concept-tagged questions</p><p>✓ Difficulty-aware generation</p><p>✓ Editable before publishing</p></div></Card><div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-5"><p className="text-xs font-semibold text-[var(--muted)]">Good practice</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use one focused topic per assessment so concept-level results stay useful.</p></div></div>
      </form>
    </div>
  </AppShell>;
}
