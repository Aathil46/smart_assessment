import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { questionSchema } from "@/lib/validation";

async function owner(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const admin = createAdminSupabaseClient();
  const { data: question } = await admin.from("questions").select("*, assessments(created_by,status)").eq("id", id).single();
  const assessment = Array.isArray(question?.assessments) ? question.assessments[0] : question?.assessments;
  return { auth, admin, question, assessment };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { auth, admin, question, assessment } = await owner(id);
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  if (!question || assessment?.created_by !== auth.user.id || assessment.status !== "draft") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Published questions are immutable." } }, { status: 403 });
  const payload = questionSchema.parse({ ...(await request.json()), assessmentId: question.assessment_id });
  const { error } = await admin.from("questions").update({ text: payload.text, choices: payload.choices, correct_answer: payload.correctAnswer, concept: payload.concept, difficulty: payload.difficulty }).eq("id", id);
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error.message } }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { auth, admin, question, assessment } = await owner(id);
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  if (!question || assessment?.created_by !== auth.user.id || assessment.status !== "draft") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Published questions are immutable." } }, { status: 403 });
  const { error } = await admin.from("questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error.message } }, { status: 500 });
  return NextResponse.json({ deleted: true });
}