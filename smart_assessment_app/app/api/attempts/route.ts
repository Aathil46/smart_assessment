import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { assessmentId } = await request.json();
  const supabase = await createServerSupabaseClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("*").eq("id", assessmentId).single();
  const { data: member } = assessment ? await admin.from("class_members").select("class_id").eq("class_id", assessment.class_id).eq("student_id", auth.user.id).single() : { data: null };
  const now = Date.now();
  if (!assessment || !member || assessment.status !== "published" || (assessment.opens_at && new Date(assessment.opens_at).getTime() > now) || (assessment.closes_at && new Date(assessment.closes_at).getTime() <= now)) return NextResponse.json({ error: { code: "NOT_AVAILABLE", message: "Assessment is not available." } }, { status: 403 });
  const { data: existing } = await admin.from("attempts").select("id,submitted_at").eq("assessment_id", assessmentId).eq("student_id", auth.user.id).is("submitted_at", null).maybeSingle();
  if (existing) return attemptResponse(admin, existing.id);
  const { count } = await admin.from("attempts").select("id", { count: "exact", head: true }).eq("assessment_id", assessmentId).eq("student_id", auth.user.id);
  if ((count ?? 0) >= assessment.attempt_limit) return NextResponse.json({ error: { code: "ATTEMPT_LIMIT", message: "Attempt limit reached." } }, { status: 409 });
  const { data: attempt, error } = await admin.from("attempts").insert({ id: randomUUID(), assessment_id: assessmentId, student_id: auth.user.id }).select("id").single();
  if (error || !attempt) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error?.message ?? "Unable to start attempt." } }, { status: 500 });
  return attemptResponse(admin, attempt.id);
}

async function attemptResponse(admin: ReturnType<typeof createAdminSupabaseClient>, attemptId: string) {
  const { data: attempt } = await admin.from("attempts").select("id,assessment_id,started_at").eq("id", attemptId).single();
  const { data: questions } = await admin.from("questions").select("id,text,choices,concept,difficulty").eq("assessment_id", attempt?.assessment_id).order("created_at");
  const { data: answers } = await admin.from("answers").select("question_id,selected_choice").eq("attempt_id", attemptId);
  return NextResponse.json({ attempt, questions: questions ?? [], answers: answers ?? [] });
}