"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { AppShell, Card, PageHeader, Status } from "@/app/components/ui";

type Assessment = {
  id: string;
  title: string;
  topic?: string | null;
};

export default function StudentPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then((d) => setAssessments(d.assessments ?? []))
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setMessage(r.ok ? "Class joined successfully." : (await r.json())?.error?.message ?? "Unable to join class.");
    if (r.ok) setCode("");
  }

  return (
    <AppShell role="student" active="Dashboard">
      <PageHeader eyebrow="Student workspace" title="Your learning workspace" description="See assessments that are actually available to your account and join classes shared by your teacher." />
      <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              <h2 className="text-base font-semibold">Available assessments</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Only published assessments currently available to you are shown.</p>
            </div>
            <Status tone="success">{loading ? "Loading" : `${assessments.length} available`}</Status>
          </div>
          {loading ? (
            <div className="space-y-3 border-t border-[var(--border)] p-5">
              {[1, 2, 3].map((item) => <div key={item} className="sa-skeleton h-16 rounded-xl" />)}
            </div>
          ) : assessments.length === 0 ? (
            <div className="border-t border-[var(--border)] p-10 text-center">
              <BookOpen className="mx-auto text-[var(--muted-foreground)]" size={24} />
              <p className="mt-3 font-semibold text-[var(--foreground)]">No assessments available</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Your published assessments will appear here when your teacher makes them available.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {assessments.slice(0, 8).map((item) => (
                <Link key={item.id} href={`/student/assessments/${item.id}/take`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--panel-muted)]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><BookOpen size={17} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{item.topic || "Assessment"}</p></div>
                  <ArrowRight size={16} className="text-[var(--muted)]" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Plus size={18} /></div>
            <div className="flex-1"><h2 className="text-sm font-semibold">Join another class</h2><p className="mt-1 text-xs text-[var(--muted)]">Enter the code shared by your teacher.</p></div>
            <form onSubmit={join} className="flex w-full gap-2 sm:w-auto"><input aria-label="Class code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-character code" className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)] sm:w-44" /><button className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">Join</button></form>
          </div>
          {message && <p className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Dashboard data policy</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">This dashboard does not display invented scores, progress percentages, learning gaps, or AI recommendations. Those insights belong on result screens where they are backed by submitted assessment data.</p>
        </Card>
      </div>
    </AppShell>
  );
}
