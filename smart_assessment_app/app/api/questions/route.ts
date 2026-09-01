import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { questionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = questionSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    const admin = createAdminSupabaseClient();
    const { data: assessment } = await admin.from("assessments").select("status,created_by").eq("id", payload.assessmentId).single();
    if (!assessment || assessment.created_by !== auth.user.id || assessment.status !== "draft") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Draft ownership required." } }, { status: 403 });
    const { data, error } = await admin.from("questions").insert({ id: randomUUID(), assessment_id: payload.assessmentId, text: payload.text, choices: payload.choices, correct_answer: payload.correctAnswer, concept: payload.concept, difficulty: payload.difficulty, source: payload.source ?? "manual" }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ question: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid question." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to save question." } }, { status: 500 });
  }
}