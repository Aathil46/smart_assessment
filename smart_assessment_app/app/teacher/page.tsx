"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, Plus, Users } from "lucide-react";

import { AppShell, Button, Card, Metric, PageHeader, Status } from "@/app/components/ui";

type Assessment = {
  id: string;
  title: string;
  topic?: string | null;
  status?: string | null;
};

type ClassItem = {
  id: string;
  name: string;
};

export default function TeacherDashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/assessments"), fetch("/api/classes")])
      .then(async ([assessmentResponse, classResponse]) => {
        if (!assessmentResponse.ok || !classResponse.ok) throw new Error("Unable to load dashboard data.");
        const [assessmentData, classData] = await Promise.all([assessmentResponse.json(), classResponse.json()]);
        if (active) {
          setAssessments(assessmentData.assessments ?? []);
          setClasses(classData.classes ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setAssessments([]);
          setClasses([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const publishedCount = useMemo(() => assessments.filter((item) => item.status === "published").length, [assessments]);
  const draftCount = useMemo(() => assessments.filter((item) => item.status === "draft").length, [assessments]);

  return (
    <AppShell role="teacher" active="Dashboard">
      <PageHeader
        eyebrow="Teacher workspace"
        title="Your teaching workspace"
        description="A focused view of your real classes and assessments."
        action={<Button href="/teacher/assessments/new" icon={<Plus size={16} />}>Create assessment</Button>}
      />
      <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Classes" value={loading ? "—" : classes.length} detail="Classes linked to your account" icon={Users} />
          <Metric label="Assessments" value={loading ? "—" : assessments.length} detail={loading ? "Loading your records" : `${publishedCount} published · ${draftCount} drafts`} icon={FileText} />
          <Metric label="Available data" value={loading ? "—" : assessments.length + classes.length} detail="Real records currently loaded" />
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">Your assessments</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Only assessments returned by your account are shown.</p>
            </div>
            <Link href="/teacher/assessments" className="text-xs font-semibold text-[var(--primary)]">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3 border-t border-[var(--border)] p-5">
              {[1, 2, 3].map((item) => <div key={item} className="sa-skeleton h-16 rounded-xl" />)}
            </div>
          ) : assessments.length === 0 ? (
            <div className="border-t border-[var(--border)] p-10 text-center">
              <p className="font-semibold text-[var(--foreground)]">No assessments yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Create an assessment to see it appear here.</p>
              <Button className="mt-5" href="/teacher/assessments/new">Create assessment</Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {assessments.slice(0, 6).map((item) => (
                <Link key={item.id} href={`/teacher/assessments/${item.id}/edit`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--panel-muted)]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><FileText size={17} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.topic || "Assessment"}</p>
                  </div>
                  <Status tone={item.status === "published" ? "success" : "neutral"}>{item.status || "Unknown"}</Status>
                  <ArrowRight size={16} className="text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--primary)]" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Dashboard data policy</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">This dashboard does not invent scores, student counts, learning gaps, or AI insights. Analytics are shown only where the existing backend provides real records.</p>
        </Card>
      </div>
    </AppShell>
  );
}
