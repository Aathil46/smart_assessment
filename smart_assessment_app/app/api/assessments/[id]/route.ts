import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin
    .from("assessments")
    .select("*, classes(id, name, subject)")
    .eq("id", id)
    .single();
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("created_by").eq("id", id).single();
  if (!assessment) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
  if (assessment.created_by !== auth.user.id) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "You can only delete your own assessments." } }, { status: 403 });
  }
  const { error } = await admin.from("assessments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error.message } }, { status: 500 });
  return NextResponse.json({ success: true, deleted: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("created_by, status").eq("id", id).single();
  if (!assessment) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Assessment not found." } }, { status: 404 });
  if (assessment.created_by !== auth.user.id) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "You can only update your own assessments." } }, { status: 403 });
  }
  const body = await request.json();
  const updateData: Record<string, any> = {};
  if (typeof body.title === "string" && body.title.trim()) updateData.title = body.title.trim();
  if (typeof body.topic === "string" && body.topic.trim()) updateData.topic = body.topic.trim();
  if (typeof body.difficulty === "string") updateData.difficulty = body.difficulty;
  if (typeof body.attempt_limit === "number") updateData.attempt_limit = body.attempt_limit;

  const { data: updated, error } = await admin.from("assessments").update(updateData).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error.message } }, { status: 500 });
  return NextResponse.json({ assessment: updated });
}