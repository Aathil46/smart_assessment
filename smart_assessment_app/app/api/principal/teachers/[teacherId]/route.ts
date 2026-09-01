import { NextResponse } from "next/server";

import { requirePrincipalSession } from "@/lib/auth/principal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ teacherId: string }> }) {
  try {
    const { teacherId } = await params;
    await requirePrincipalSession();

    const supabase = await createServerSupabaseClient();

    // Fetch the teacher profile (RLS ensures it's in the same school)
    const { data: teacher, error: teacherError } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", teacherId)
      .eq("role", "teacher")
      .single();

    if (teacherError || !teacher) {
      return NextResponse.json({ error: { message: "Teacher not found or unauthorized." } }, { status: 404 });
    }

    // Fetch assessments published by this teacher
    const { data: assessments, error: assessmentsError } = await supabase
      .from("assessments")
      .select("id, title, topic, status, created_at, classes!inner(grade, subject)")
      .eq("created_by", teacherId)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (assessmentsError) {
      return NextResponse.json({ error: { message: "Failed to fetch assessments." } }, { status: 500 });
    }

    // Format the response
    const formattedAssessments = assessments.map((a: any) => ({
      id: a.id,
      title: a.title,
      topic: a.topic,
      createdAt: a.created_at,
      grade: Array.isArray(a.classes) ? a.classes[0]?.grade : a.classes?.grade,
      subject: Array.isArray(a.classes) ? a.classes[0]?.subject : a.classes?.subject,
    }));

    return NextResponse.json({
      teacherName: teacher.name,
      assessments: formattedAssessments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
