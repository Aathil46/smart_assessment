import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateAssessmentQuestions } from "@/lib/gemini/assessment";

export async function POST(_: Request, { params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = await params; const supabase = await createServerSupabaseClient(); const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient(); const { data: gap } = await admin.from("learning_gaps").select("concept,attempts(student_id)").eq("attempt_id", gapId).single();
  const attempt = Array.isArray(gap?.attempts) ? gap.attempts[0] : gap?.attempts;
  if (!gap || attempt?.student_id !== auth.user.id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gap not found." } }, { status: 404 });
  try {
    const questions = await generateAssessmentQuestions({ topic: gap.concept, difficulty: "medium", count: 4, material: `Create targeted practice for the concept ${gap.concept}.` });
    const { data, error } = await admin.from("practice_sets").insert({ id: randomUUID(), student_id: auth.user.id, concept: gap.concept, questions }).select("id,concept,questions,created_at").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ practiceSet: data });
  } catch (error) { return NextResponse.json({ error: { code: "AI_GENERATION_ERROR", message: error instanceof Error ? error.message : "Unable to generate practice." } }, { status: 502 }); }
}