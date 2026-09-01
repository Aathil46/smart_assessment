import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { aggregateClassPerformance } from "@/lib/analytics";
import { requirePrincipalSession } from "@/lib/auth/principal";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requirePrincipalSession();

    // The authenticated client applies the RLS policies automatically.
    // Principals can only see assessments, attempts, members, etc. if the teacher belongs to their school.
    const supabase = await createServerSupabaseClient();

    // Verify assessment (RLS will return null if unauthorized/cross-school)
    const { data: assessment } = await supabase
      .from("assessments")
      .select("*, classes!inner(name, teacher_id, profiles!classes_teacher_id_fkey(name))")
      .eq("id", id)
      .single();

    if (!assessment) {
      return NextResponse.json(
        { error: { message: "Assessment not found or unauthorized." } },
        { status: 404 },
      );
    }

    const teacherName = Array.isArray(assessment.classes.profiles) 
      ? assessment.classes.profiles[0]?.name 
      : (assessment.classes.profiles as any)?.name;

    // 1. Fetch class members
    const { data: members } = await supabase
      .from("class_members")
      .select("student_id")
      .eq("class_id", assessment.class_id);

    const studentIds = (members ?? []).map((m) => m.student_id);

    // 2. Fetch profiles for enrolled students
    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", studentIds);
      studentProfiles = profilesData ?? [];
    }

    // 3. Fetch attempts for this assessment
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, student_id, score, total, started_at, submitted_at")
      .eq("assessment_id", id);

    const attemptIds = (attempts ?? []).filter((a) => a.submitted_at).map((a) => a.id);

    // 4. Fetch concept performance for completed attempts
    let conceptPerfs: any[] = [];
    if (attemptIds.length > 0) {
      const { data: cpData } = await supabase
        .from("concept_perf")
        .select("attempt_id, concept, correct_count, total_count, accuracy, level")
        .in("attempt_id", attemptIds);
      conceptPerfs = cpData ?? [];
    }

    const result = aggregateClassPerformance(
      members ?? [],
      studentProfiles,
      attempts ?? [],
      conceptPerfs
    );

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        topic: assessment.topic,
        class_name: assessment.classes.name,
        teacher_name: teacherName || "Unknown",
      },
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
