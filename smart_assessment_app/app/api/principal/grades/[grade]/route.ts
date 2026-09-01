import { NextResponse } from "next/server";

import { requirePrincipalSession } from "@/lib/auth/principal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ grade: string }> }) {
  try {
    const { grade } = await params;
    await requirePrincipalSession();

    const supabase = await createServerSupabaseClient();
    
    // Because of RLS, classes are already filtered by the principal's school
    const { data: classes, error } = await supabase
      .from("classes")
      .select("id, subject, teacher_id, profiles!classes_teacher_id_fkey(name)")
      .eq("grade", grade);

    if (error) {
      return NextResponse.json({ error: { message: "Failed to fetch classes." } }, { status: 500 });
    }

    // Group by teacher to get a list of teachers and their subjects for this grade
    const teacherMap = new Map<string, { id: string; name: string; subjects: Set<string> }>();

    for (const c of classes) {
      const tId = c.teacher_id;
      const tName = Array.isArray(c.profiles) ? c.profiles[0]?.name : (c.profiles as any)?.name;
      
      if (!teacherMap.has(tId)) {
        teacherMap.set(tId, { id: tId, name: tName || "Unknown", subjects: new Set() });
      }
      if (c.subject) {
        teacherMap.get(tId)!.subjects.add(c.subject);
      }
    }

    const teachers = Array.from(teacherMap.values()).map(t => ({
      id: t.id,
      name: t.name,
      subjects: Array.from(t.subjects).sort()
    }));

    // Sort teachers alphabetically by name
    teachers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ teachers });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
