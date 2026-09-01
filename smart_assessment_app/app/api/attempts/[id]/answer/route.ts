import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { answerSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const payload = answerSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    const admin = createAdminSupabaseClient();
    const { data: attempt } = await admin.from("attempts").select("student_id,submitted_at").eq("id", id).single();
    const { data: question } = await admin.from("questions").select("choices,assessment_id").eq("id", payload.questionId).single();
    if (!attempt || attempt.student_id !== auth.user.id || attempt.submitted_at || !question || !Array.isArray(question.choices) || !question.choices.includes(payload.selectedChoice)) return NextResponse.json({ error: { code: "INVALID_ANSWER", message: "Answer cannot be saved." } }, { status: 400 });
    const { error } = await admin.from("answers").upsert({ attempt_id: id, question_id: payload.questionId, selected_choice: payload.selectedChoice }, { onConflict: "attempt_id,question_id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Choose one answer." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to save answer." } }, { status: 500 });
  }
}