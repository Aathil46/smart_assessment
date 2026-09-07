import Link from "next/link";
import { ArrowRight, BookOpen, Plus, Users } from "lucide-react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireTeacherSession } from "@/lib/auth/teacher";
import { AppShell, Button, Card, PageHeader } from "@/app/components/ui";

export default async function TeacherClassesPage() {
  await requireTeacherSession();
  const supabase = await createServerSupabaseClient();
  const { data: classes } = await supabase.from("classes").select("*").order("created_at", { ascending: false });

  return <AppShell role="teacher" active="Classes">
    <PageHeader eyebrow="Workspace" title="My classes" description="Manage your classrooms, share join codes, and move learners into assessment workflows." action={<Button href="/teacher/classes/new" icon={<Plus size={16}/>}>Create class</Button>} />
    <div className="mx-auto max-w-[1240px] space-y-6 px-5 py-7 sm:px-8 lg:px-10">
      {(classes ?? []).length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(classes ?? []).map((klass, index) => <Link key={klass.id} href={`/teacher/classes/${klass.id}`} className="sa-fade-up block" style={{animationDelay:`${index * 60}ms`}}><Card className="group h-full p-5"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><BookOpen size={18}/></div><ArrowRight size={16} className="text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1"/></div><p className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-[var(--primary)]">{klass.subject ?? "General"}</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{klass.name}</h2><p className="mt-2 text-sm text-[var(--muted)]">Grade {klass.grade ?? "N/A"}</p><div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--panel-muted)] px-3 py-2"><span className="text-[11px] font-medium text-[var(--muted)]">Join code</span><span className="font-mono text-sm font-semibold tracking-wider">{klass.code}</span></div><div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]"><Users size={14}/> Classroom workspace</div></Card></Link>)}</div> : <Card className="sa-fade-up border-dashed bg-[var(--panel-muted)] p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--primary)] shadow-sm"><BookOpen size={20}/></div><p className="mt-5 text-lg font-semibold">No classes yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Create your first class to get a join code and start building your assessment workflow.</p><div className="mt-5"><Button href="/teacher/classes/new" icon={<Plus size={16}/>}>Create your first class</Button></div></Card>}
    </div>
  </AppShell>;
}
