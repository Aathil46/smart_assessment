import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { publishSchema, questionSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = publishSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    const admin = createAdminSupabaseClient();
    const { data: assessment } = await admin.from("assessments").select("*").eq("id", id).eq("created_by", auth.user.id).single();
    const { data: questions } = await admin.from("questions").select("*").eq("assessment_id", id);
    if (!assessment || assessment.status !== "draft") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only draft assessments can be published." } }, { status: 403 });
    if (!questions?.length || questions.some((question) => questionSchema.safeParse({ ...question, assessmentId: id, correctAnswer: question.correct_answer }).success === false)) return NextResponse.json({ error: { code: "INVALID_QUESTIONS", message: "Every question must be valid before publishing." } }, { status: 400 });
    const updatePayload: Record<string, any> = {
      attempt_limit: payload.attemptLimit,
      status: "published",
    };
    if (payload.opensAt !== undefined) {
      updatePayload.opens_at = payload.opensAt;
    }
    if (payload.closesAt !== undefined) {
      updatePayload.closes_at = payload.closesAt;
    }
    const { error } = await admin.from("assessments").update(updatePayload).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ status: "published" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid publish settings." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to publish." } }, { status: 500 });
  }
}