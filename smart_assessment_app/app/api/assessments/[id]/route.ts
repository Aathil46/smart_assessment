import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("*").eq("id", id).single();
  if (!assessment) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).single();
  const teacher = profile?.role === "teacher" && assessment.created_by === auth.user.id;
  if (!teacher) {
    const { data: member } = await admin.from("class_members").select("class_id").eq("class_id", assessment.class_id).eq("student_id", auth.user.id).single();
    const now = Date.now();
    if (assessment.status !== "published" || !member || (assessment.opens_at && new Date(assessment.opens_at).getTime() > now) || (assessment.closes_at && new Date(assessment.closes_at).getTime() <= now)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Assessment is not available." } }, { status: 403 });
  }
  const { data: questions } = await admin.from("questions").select("id,text,choices,concept,difficulty,source,correct_answer").eq("assessment_id", id).order("created_at");
    const studentQuestions = (questions ?? []).map((question) =>
      Object.fromEntries(Object.entries(question).filter(([key]) => key !== "correct_answer")),
    );
    return NextResponse.json({ assessment: { ...assessment, questions: teacher ? questions : studentQuestions } });
}