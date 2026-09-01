import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateAssessmentQuestions } from "@/lib/gemini/assessment";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("*, materials(extracted_text,status)").eq("id", id).eq("created_by", auth.user.id).single();
  if (!assessment || assessment.status !== "draft") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only your draft assessments can be generated." } }, { status: 403 });
  const material = Array.isArray(assessment.materials) ? assessment.materials[0] : assessment.materials;
  if (!material || material.status !== "processed" || !material.extracted_text) return NextResponse.json({ error: { code: "INVALID_MATERIAL", message: "Material is not ready." } }, { status: 400 });
  try {
    const questions = await generateAssessmentQuestions({ topic: assessment.topic, difficulty: assessment.difficulty, count: assessment.num_questions, material: material.extracted_text });
    await admin.from("questions").delete().eq("assessment_id", id);
    const { error } = await admin.from("questions").insert(questions.map((question) => ({
      assessment_id: id,
      text: question.text,
      choices: question.choices,
      correct_answer: question.correctAnswer,
      concept: question.concept,
      difficulty: question.difficulty,
      source: "ai",
    })));
    if (error) throw new Error(error.message);
    return NextResponse.json({ assessmentId: id, questionCount: questions.length, status: "draft" });
  } catch (error) {
    return NextResponse.json({ error: { code: "AI_GENERATION_ERROR", message: error instanceof Error ? error.message : "Unable to generate questions." } }, { status: 502 });
  }
}