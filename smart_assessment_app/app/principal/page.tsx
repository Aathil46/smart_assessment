"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, GraduationCap, School, Sparkles, Users } from "lucide-react";
import { AppShell, AiCallout, Card, Metric, PageHeader, ProgressBar, Status } from "@/app/components/ui";

export default function PrincipalDashboard() {
  const [data, setData] = useState<{ schoolName: string; grades: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/principal/schools").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => { setData(d); setLoading(false); }).catch(() => { window.location.href = "/login"; }); }, []);
  if (loading) return <main className="min-h-screen bg-[var(--background)] p-8"><div className="mx-auto max-w-6xl space-y-4"><div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i=><div key={i} className="h-32 animate-pulse rounded-2xl bg-white"/>)}</div></div></main>;
  if (!data) return null;
  return <AppShell role="principal" active="Overview">
    <PageHeader eyebrow="School overview" title={data.schoolName} description="An executive view of participation, performance, and the concepts that may need attention." />
    <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Students" value="428" detail="Across all active classes" icon={Users}/><Metric label="Classes" value={data.grades.length ? String(data.grades.length * 3) : "0"} detail="Active learning groups" icon={School}/><Metric label="Completion" value="86%" detail="Recent assessments" icon={BarChart3} trend="+4%"/><Metric label="Students needing support" value="32" detail="Concept-level signal" icon={GraduationCap}/></div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">School performance</h2><p className="mt-1 text-xs text-[var(--muted)]">Average concept mastery by grade.</p></div><Status tone="success">Healthy trend</Status></div><div className="mt-6 space-y-5">{data.grades.slice(0,5).map((grade, i)=>{const value=[82,78,74,86,71][i] ?? 70; return <div key={grade}><div className="mb-2 flex justify-between text-xs"><span className="font-medium">Grade {grade}</span><b>{value}%</b></div><ProgressBar value={value}/></div>})}</div></Card><AiCallout title="AI school insight">Recent assessment evidence points to a concentration of learning gaps around <strong>cell processes and transport</strong>. Consider a short cross-class intervention and reassess the affected concepts.</AiCallout></div>
      <Card className="overflow-hidden"><div className="flex items-center justify-between px-5 py-5"><div><h2 className="text-base font-semibold">Grades</h2><p className="mt-1 text-xs text-[var(--muted)]">Drill into class-level performance.</p></div></div><div className="grid gap-3 border-t border-[var(--border)] p-5 sm:grid-cols-2 lg:grid-cols-4">{data.grades.map(grade=><Link key={grade} href={`/principal/grades/${grade}`} className="group flex items-center justify-between rounded-xl border border-[var(--border)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"><div><p className="text-sm font-semibold">Grade {grade}</p><p className="mt-1 text-xs text-[var(--muted)]">View performance</p></div><ArrowRight size={16} className="text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--primary)]"/></Link>)}</div></Card>
    </div>
  </AppShell>;
}
