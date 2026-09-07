"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { AppShell, Card, PageHeader, Status } from "@/app/components/ui";

type SchoolData = {
  schoolName: string;
  grades: string[];
};

export default function PrincipalDashboard() {
  const [data, setData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/principal/schools")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => { window.location.href = "/login"; })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell role="principal">
        <div className="mx-auto max-w-6xl space-y-5 px-5 py-8 sm:px-8">
          <div className="sa-skeleton h-5 w-32 rounded" />
          <div className="sa-skeleton h-12 w-64 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="sa-skeleton h-28 rounded-2xl" />)}</div>
          <div className="sa-skeleton h-64 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!data) return null;

  return (
    <AppShell role="principal" active="Overview">
      <PageHeader eyebrow="School overview" title={data.schoolName} description="Navigate through the school structure and open analytics where real assessment data is available." />
      <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><GraduationCap size={18} /></div>
            <div>
              <h2 className="text-base font-semibold">School data</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Only grades returned by the school API are listed below. Student counts, scores, completion rates, and AI insights are not fabricated.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--panel-muted)] px-4 py-3">
            <span className="text-sm text-[var(--muted)]">Grades available</span>
            <Status tone="neutral">{data.grades.length}</Status>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-5">
            <h2 className="text-base font-semibold">Grades</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Drill into grade-level faculty and assessment analytics.</p>
          </div>
          {data.grades.length === 0 ? (
            <div className="border-t border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">No grades are available yet.</div>
          ) : (
            <div className="grid gap-3 border-t border-[var(--border)] p-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.grades.map((grade) => (
                <Link key={grade} href={`/principal/grades/${grade}`} className="group flex items-center justify-between rounded-xl border border-[var(--border)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]">
                  <div><p className="text-sm font-semibold">Grade {grade}</p><p className="mt-1 text-xs text-[var(--muted)]">View grade analytics</p></div>
                  <ArrowRight size={16} className="text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--primary)]" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Analytics availability</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Detailed performance and AI review cards are shown inside assessment analytics only when the backend provides the underlying assessment results. This keeps the principal dashboard free from placeholder school statistics.</p>
        </Card>
      </div>
    </AppShell>
  );
}
