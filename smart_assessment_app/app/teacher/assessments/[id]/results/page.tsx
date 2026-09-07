"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Clock3, Download, Search, Sparkles, Users, X } from "lucide-react";
import { type ClassPerformanceResult } from "@/lib/analytics";
import { AiCallout, AppShell, Card, PageHeader, ProgressBar, Status } from "@/app/components/ui";

type ResultData = ClassPerformanceResult & {
  assessment: { id: string; title: string; topic: string | null; class_name: string };
  error?: { message: string };
};
type IndividualStudentData = {
  status: "completed" | "in_progress" | "not_started";
  student: { id: string; name: string; email: string };
  assessment: { title: string; topic: string | null };
  attempt?: { id: string; score: number; total: number; percentage: number; passFail: "Pass" | "Fail"; isWeakStudent: boolean; submittedAt: string };
  conceptPerformance?: Array<{ concept: string; correctCount: number; totalCount: number; accuracyPercentage: number; level: "Strong" | "Medium" | "Weak" }>;
  gaps?: Array<{ concept: string; gap_level: string; notes: string; recommendations: string[] }>;
};
type FilterType = "All" | "Completed" | "In Progress" | "Failed" | "Weak";
type SortType = "most_recent" | "name_asc";

const toneForLevel = (level: string): "success" | "warning" | "error" | "neutral" => level === "Strong" ? "success" : level === "Medium" ? "warning" : level === "Weak" ? "error" : "neutral";

export default function TeacherResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [sortOption, setSortOption] = useState<SortType>("most_recent");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<IndividualStudentData | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  useEffect(() => {
    fetch(`/api/results/teacher/${id}`).then((r) => r.json()).then((d) => d.error ? setError(d.error.message) : setData(d)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const openStudentDetail = (studentId: string) => {
    setSelectedStudentId(studentId); setLoadingStudent(true); setStudentDetail(null);
    fetch(`/api/results/teacher/${id}/student/${studentId}`).then((r) => r.json()).then(setStudentDetail).catch(() => setStudentDetail(null)).finally(() => setLoadingStudent(false));
  };
  const closeStudentDetail = () => { setSelectedStudentId(null); setStudentDetail(null); };

  const processedStudents = useMemo(() => {
    if (!data?.studentResults) return [];
    let list = [...data.studentResults];
    const q = searchTerm.toLowerCase().trim();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    if (activeFilter === "Completed") list = list.filter((s) => s.status === "Completed");
    if (activeFilter === "In Progress") list = list.filter((s) => s.status === "In Progress");
    if (activeFilter === "Failed") list = list.filter((s) => s.status === "Completed" && s.passFail === "Fail");
    if (activeFilter === "Weak") list = list.filter((s) => s.isWeakStudent);
    list.sort((a, b) => sortOption === "name_asc" ? a.name.localeCompare(b.name) : ((b.submittedAt ? new Date(b.submittedAt).getTime() : 0) - (a.submittedAt ? new Date(a.submittedAt).getTime() : 0)) || a.name.localeCompare(b.name));
    return list;
  }, [data?.studentResults, searchTerm, activeFilter, sortOption]);

  if (loading) return <AppShell role="teacher" active="Assessments"><div className="p-5 sm:p-8 lg:p-10"><div className="mx-auto max-w-6xl space-y-5"><div className="h-32 animate-pulse rounded-2xl bg-white"/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1,2,3,4,5].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-white"/>)}</div></div></div></AppShell>;
  if (error || !data) return <AppShell role="teacher" active="Assessments"><div className="mx-auto max-w-4xl p-5 sm:p-10"><Card className="p-10 text-center"><AlertTriangle className="mx-auto text-[var(--error)]"/><h1 className="mt-4 text-xl font-semibold">Unable to load results</h1><p className="mt-2 text-sm text-[var(--muted)]">{error || "Something went wrong."}</p><Link href="/teacher" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"><ArrowLeft size={16}/> Back to dashboard</Link></Card></div></AppShell>;

  const { assessment, overview, weakConcepts, mediumConcepts } = data;
  const completionRate = overview.totalStudents ? Math.round((overview.completed / overview.totalStudents) * 100) : 0;
  const passRate = overview.completed ? Math.round((overview.passed / overview.completed) * 100) : 0;

  return <AppShell role="teacher" active="Assessments">
    <PageHeader eyebrow={`${assessment.class_name} · Assessment analytics`} title={assessment.title} description={assessment.topic || "Review student outcomes, identify learning gaps, and decide what to reteach next."} action={<div className="flex gap-2"><Link href={`/teacher/assessments/${id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm"><ArrowLeft size={16}/> Editor</Link><a href={`/api/results/teacher/${id}/export`} download className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)]"><Download size={16}/> Export</a></div>}/>
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8 lg:p-10">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[{label:"Students",value:overview.totalStudents,icon:Users},{label:"Completed",value:overview.completed,icon:CheckCircle2},{label:"In progress",value:overview.inProgress,icon:Clock3},{label:"Passed",value:overview.passed,icon:BarChart3},{label:"Failed",value:overview.failed,icon:AlertTriangle}].map(({label,value,icon:Icon}, i) => <Card key={label} className={`sa-fade-up p-5 sa-delay-${Math.min(i+1,4)}`}><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon size={18}/></div>{label === "Passed" && <span className="text-xs font-semibold text-[var(--success)]">{passRate}%</span>}</div><p className="mt-5 text-xs font-medium text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p></Card>)}
      </section>

      {overview.completed === 0 ? <Card className="p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Clock3 size={22}/></div><h2 className="mt-4 text-lg font-semibold">Waiting for the first submission</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Once students submit, concept accuracy and individual learning-gap signals will appear here automatically.</p></Card> : <>
        <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Participation</p><h2 className="mt-1 text-lg font-semibold">Assessment completion</h2></div><span className="text-2xl font-semibold">{completionRate}%</span></div><div className="mt-5"><ProgressBar value={completionRate}/></div><div className="mt-4 flex justify-between text-xs text-[var(--muted)]"><span>{overview.completed} submitted</span><span>{overview.inProgress} still in progress</span></div></Card>
          <AiCallout title="Teaching signal">{weakConcepts.length > 0 ? <><strong>{weakConcepts[0].concept}</strong> is the clearest reteaching priority at {weakConcepts[0].accuracyPercentage}% accuracy. Use the affected-student list below to target support.</> : "No weak concepts were detected in this assessment. Keep reinforcing the concepts where students are performing well."}</AiCallout>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--error)]">Reteach priority</p><h2 className="mt-1 text-lg font-semibold">Weak concepts</h2></div><Status tone="error">{weakConcepts.length} flagged</Status></div><div className="mt-5 space-y-3">{weakConcepts.length === 0 ? <p className="rounded-xl bg-[var(--panel-muted)] p-5 text-sm text-[var(--muted)]">No weak concepts detected.</p> : weakConcepts.map((wc) => <div key={wc.concept} className="rounded-xl border border-[var(--border)] p-4 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{wc.concept}</p><span className="text-sm font-bold text-[var(--error)]">{wc.accuracyPercentage}%</span></div><div className="mt-3"><ProgressBar value={wc.accuracyPercentage}/></div><p className="mt-2 text-xs text-[var(--muted)]">{wc.affectedStudents.length} student{wc.affectedStudents.length === 1 ? "" : "s"} affected</p></div>)}</div></Card>
          <Card className="p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--warning)]">Monitor</p><h2 className="mt-1 text-lg font-semibold">Concepts needing attention</h2></div><Status tone="warning">{mediumConcepts.length} watch</Status></div><div className="mt-5 space-y-3">{mediumConcepts.length === 0 ? <p className="rounded-xl bg-[var(--panel-muted)] p-5 text-sm text-[var(--muted)]">No medium concepts requiring attention.</p> : mediumConcepts.map((mc) => <div key={mc.concept} className="rounded-xl border border-[var(--border)] p-4 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{mc.concept}</p><span className="text-sm font-bold text-[var(--warning)]">{mc.accuracyPercentage}%</span></div><div className="mt-3"><ProgressBar value={mc.accuracyPercentage}/></div><p className="mt-2 text-xs text-[var(--muted)]">{mc.affectedStudents.length} student{mc.affectedStudents.length === 1 ? "" : "s"} affected</p></div>)}</div></Card>
        </section>
      </>}

      <section><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]">Student-level view</p><h2 className="mt-1 text-xl font-semibold">Student results</h2><p className="mt-1 text-sm text-[var(--muted)]">Click any student to inspect concept performance and learning gaps.</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search size={16} className="absolute left-3 top-2.5 text-[var(--muted-foreground)]"/><input aria-label="Search students" placeholder="Search students" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 sm:w-56"/></label><select aria-label="Sort students" value={sortOption} onChange={(e) => setSortOption(e.target.value as SortType)} className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"><option value="most_recent">Most recent</option><option value="name_asc">A–Z</option></select></div></div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">{(["All","Completed","In Progress","Failed","Weak"] as FilterType[]).map((tab) => <button key={tab} onClick={() => setActiveFilter(tab)} className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${activeFilter === tab ? "bg-[var(--primary)] text-white shadow-sm" : "bg-white text-[var(--muted)] hover:bg-slate-100"}`}>{tab}</button>)}</div>
        <Card className="mt-4 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[var(--panel-muted)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3.5">Student</th><th className="px-5 py-3.5">Score</th><th className="px-5 py-3.5">Accuracy</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr></thead><tbody>{processedStudents.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--muted)]">{searchTerm ? "No students match your search." : activeFilter !== "All" ? "No students match this filter." : "No students enrolled."}</td></tr> : processedStudents.map((sr, index) => <tr key={sr.student_id} className="border-t border-[var(--border)] transition-colors hover:bg-slate-50/70 sa-fade-in" style={{animationDelay:`${Math.min(index,8)*45}ms`}}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">{sr.name.split(" ").map((n) => n[0]).join("").slice(0,2)}</div><div><p className="font-semibold">{sr.name}</p>{sr.isWeakStudent && <Status tone="error">Weak</Status>}</div></div></td><td className="px-5 py-4 text-[var(--muted)]">{sr.status === "Completed" ? `${sr.score} / ${sr.total}` : "—"}</td><td className="px-5 py-4 font-semibold">{sr.status === "Completed" ? `${sr.percentage}%` : "—"}</td><td className="px-5 py-4">{sr.status === "Completed" ? <Status tone={sr.passFail === "Pass" ? "success" : "error"}>{sr.passFail}</Status> : sr.status === "In Progress" ? <Status tone="warning">In Progress</Status> : <Status tone="neutral">Not started</Status>}</td><td className="px-5 py-4 text-right"><button onClick={() => openStudentDetail(sr.student_id)} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm">View result</button></td></tr>)}</tbody></table></div></Card>
      </section>
    </div>

    {selectedStudentId && <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && closeStudentDetail()}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl sa-fade-in"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-5 py-4 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]">Student detail</p><h3 className="mt-1 text-lg font-semibold">{studentDetail?.student?.name ?? "Student performance"}</h3></div><button aria-label="Close student details" onClick={closeStudentDetail} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition hover:bg-slate-50"><X size={17}/></button></div><div className="space-y-6 p-5 sm:p-6">{loadingStudent ? <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-[var(--panel-muted)]"/>)}</div> : !studentDetail ? <Card className="p-8 text-center text-sm text-[var(--error)]">Failed to load student details.</Card> : studentDetail.status === "not_started" ? <Card className="p-8 text-center"><Clock3 className="mx-auto text-[var(--muted)]"/><h4 className="mt-3 font-semibold">Assessment not started</h4><p className="mt-1 text-sm text-[var(--muted)]">This student has not started the assessment yet.</p></Card> : studentDetail.status === "in_progress" ? <Card className="border-[var(--warning)]/30 bg-[var(--warning-soft)] p-8 text-center"><Clock3 className="mx-auto text-[var(--warning)]"/><h4 className="mt-3 font-semibold">Assessment in progress</h4><p className="mt-1 text-sm text-[var(--muted)]">The student has started but not submitted. Final concept performance is not available yet.</p></Card> : <><Card className="p-5"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Overall score</p><p className="mt-1 text-3xl font-semibold">{studentDetail.attempt?.percentage}%</p><p className="text-sm text-[var(--muted)]">{studentDetail.attempt?.score} of {studentDetail.attempt?.total} correct</p></div><Status tone={studentDetail.attempt?.passFail === "Pass" ? "success" : "error"}>{studentDetail.attempt?.passFail}</Status></div></Card><Card className="p-5"><h4 className="font-semibold">Concept performance</h4><div className="mt-4 space-y-4">{studentDetail.conceptPerformance?.map((cp) => <div key={cp.concept}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{cp.concept}</span><div className="flex items-center gap-2"><span className="font-semibold">{cp.accuracyPercentage}%</span><Status tone={toneForLevel(cp.level)}>{cp.level}</Status></div></div><div className="mt-2"><ProgressBar value={cp.accuracyPercentage}/></div></div>)}</div></Card>{studentDetail.gaps && studentDetail.gaps.length > 0 && <div><div className="mb-3 flex items-center gap-2"><Sparkles size={16} className="text-[var(--ai)]"/><h4 className="font-semibold">Learning gaps</h4></div><div className="space-y-3">{studentDetail.gaps.map((gap) => <div key={gap.concept} className="rounded-2xl border border-[#ded5ff] bg-[var(--ai-soft)] p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{gap.concept}</p><Status tone="ai">{gap.gap_level}</Status></div>{gap.notes && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{gap.notes}</p>}{gap.recommendations?.length > 0 && <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">{gap.recommendations.map((rec, i) => <li key={i} className="flex gap-2"><span className="text-[var(--ai)]">•</span>{rec}</li>)}</ul>}</div>)}</div></div>}</>}</div></aside></div>}
  </AppShell>;
}
