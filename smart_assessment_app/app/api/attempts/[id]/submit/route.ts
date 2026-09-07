import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateAttempt } from "@/lib/conceptEngine";
import { explainGap } from "@/lib/gemini/gaps";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
      { status: 401 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("*")
    .eq("id", id)
    .eq("student_id", auth.user.id)
    .single();

  if (!attempt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attempt not found." } },
      { status: 404 },
    );
  }

  const { data: questions } = await admin
    .from("questions")
    .select("id,correct_answer,concept")
    .eq("assessment_id", attempt.assessment_id);

  const { data: answers } = await admin
    .from("answers")
    .select("question_id,selected_choice")
    .eq("attempt_id", id);

  const evaluation = evaluateAttempt(questions ?? [], answers ?? []);

  // Update answer correctness
  for (const evaluated of evaluation.evaluatedAnswers) {
    await admin
      .from("answers")
      .update({ is_correct: evaluated.isCorrect })
      .eq("attempt_id", id)
      .eq("question_id", evaluated.questionId);
  }

  // Lock attempt with score and timestamp
  const submittedAt = attempt.submitted_at ?? new Date().toISOString();
  await admin
    .from("attempts")
    .update({
      score: evaluation.score,
      total: evaluation.total,
      submitted_at: submittedAt,
    })
    .eq("id", id);

  // Idempotently upsert concept performance
  if (evaluation.conceptPerformance.length > 0) {
    const { error: conceptPerfError } = await admin.from("concept_perf").upsert(
      evaluation.conceptPerformance.map((cp) => ({
        attempt_id: id,
        concept: cp.concept,
        correct_count: cp.correctCount,
        total_count: cp.totalCount,
        accuracy: cp.accuracy,
        level: cp.level,
      })),
      { onConflict: "attempt_id,concept" },
    );

    if (conceptPerfError) {
      console.error("[attempt submit] concept_perf upsert failed", {
        attemptId: id,
        message: conceptPerfError.message,
        code: conceptPerfError.code,
        details: conceptPerfError.details,
        hint: conceptPerfError.hint,
      });
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Unable to persist concept performance." } },
        { status: 500 },
      );
    }
  }

  // Generate learning gaps ONLY for Weak concepts
  let persistedGaps = evaluation.learningGaps;
  if (evaluation.learningGaps.length > 0) {
    const enrichedGaps = await Promise.all(
      evaluation.learningGaps.map(async (gap) => {
        const notes = await explainGap({
          concept: gap.concept,
          mastery: gap.accuracyPercentage,
          level: gap.level,
        });
        return {
          ...gap,
          notes,
          recommendations: [],
        };
      }),
    );

    await admin.from("learning_gaps").upsert(
      enrichedGaps.map((gap) => ({
        attempt_id: id,
        concept: gap.concept,
        gap_level: gap.level,
        notes: gap.notes ?? null,
        recommendations: gap.recommendations,
      })),
      { onConflict: "attempt_id,concept" },
    );

    persistedGaps = enrichedGaps;
  }

  return NextResponse.json({
    score: evaluation.score,
    total: evaluation.total,
    percentage: evaluation.percentage,
    passFail: evaluation.passFail,
    isWeakStudent: evaluation.isWeakStudent,
    conceptPerformance: evaluation.conceptPerformance,
    gaps: persistedGaps,
  });
}