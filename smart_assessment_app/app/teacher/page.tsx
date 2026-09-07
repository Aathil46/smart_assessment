import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BookOpen, FileText, Plus, Sparkles, Users } from "lucide-react";

import { requireTeacherSession } from "@/lib/auth/teacher";
import { AppShell, AiCallout, AssessmentRow, Button, Card, Metric, PageHeader, ProgressBar, Status } from "@/app/components/ui";

export default async function TeacherDashboardPage() {
  try { await requireTeacherSession(); } catch { redirect("/login"); }

  return (
    <AppShell role="teacher" active="Dashboard">
      <PageHeader eyebrow="Teacher workspace" title="Good afternoon, Aathil" description="A focused view of what is happening across your classes and where students may need support." action={<Button href="/teacher/assessments/new" icon={<Plus size={16} />}>Create assessment</Button>} />
      <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Active classes" value="4" detail="126 enrolled students" icon={Users} trend="+1 this term" />
          <Metric label="Assessments" value="18" detail="14 published · 4 drafts" icon={FileText} />
          <Metric label="Average score" value="78%" detail="Across recent submissions" icon={BarChart3} trend="+6%" />
          <Metric label="Students needing support" value="12" detail="Based on concept performance" icon={Sparkles} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-5"><div><h2 className="text-base font-semibold">Recent assessments</h2><p className="mt-1 text-xs text-[var(--muted)]">Track participation and class performance.</p></div><Link href="/teacher/assessments" className="text-xs font-semibold text-[var(--primary)]">View all</Link></div>
            <AssessmentRow name="Photosynthesis — Unit 3" className="10A" status="Published" score="84%" due="31 submissions" />
            <AssessmentRow name="Cell Structure Check" className="10B" status="Published" score="76%" due="28 submissions" />
            <AssessmentRow name="Genetics Review" className="10A" status="In progress" score="—" due="12 started" />
            <AssessmentRow name="Ecology Foundations" className="9C" status="Draft" />
          </Card>
          <div className="space-y-6">
            <AiCallout title="AI teaching signal">Stomata is the most common weak concept across recent Biology work. Consider a short visual recap before the next assessment.</AiCallout>
            <Card className="p-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><BookOpen size={17}/></div><div><h2 className="text-sm font-semibold">Class health</h2><p className="text-xs text-[var(--muted)]">Concept mastery by class</p></div></div><div className="mt-5 space-y-5"><div><div className="mb-2 flex justify-between text-xs"><span className="font-medium">10A · Biology</span><span className="font-semibold">84%</span></div><ProgressBar value={84}/></div><div><div className="mb-2 flex justify-between text-xs"><span className="font-medium">10B · Biology</span><span className="font-semibold">76%</span></div><ProgressBar value={76}/></div><div><div className="mb-2 flex justify-between text-xs"><span className="font-medium">9C · Science</span><span className="font-semibold">71%</span></div><ProgressBar value={71}/></div></div></Card>
          </div>
        </div>
        <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold">Needs attention</h2><Status tone="warning">12 students</Status></div><p className="mt-1 text-sm text-[var(--muted)]">Students with one or more concepts currently below the support threshold.</p></div><Button href="/teacher/assessments" variant="secondary">Review results</Button></div></Card>
      </div>
    </AppShell>
  );
}
