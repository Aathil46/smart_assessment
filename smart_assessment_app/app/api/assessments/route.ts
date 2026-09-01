import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assessmentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = assessmentSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (profileError || profile?.role !== "teacher") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Teacher access required." } }, { status: 403 });
    }
    const user = auth.user;
    const admin = createAdminSupabaseClient();
    const { data: klass } = await admin.from("classes").select("id").eq("id", payload.classId).eq("teacher_id", user.id).single();
    const { data: material } = await admin.from("materials").select("id,status").eq("id", payload.materialId).eq("class_id", payload.classId).single();
    if (!klass || material?.status !== "processed") return NextResponse.json({ error: { code: "INVALID_MATERIAL", message: "Choose a processed material from your class." } }, { status: 400 });
    const { data, error } = await admin.from("assessments").insert({ id: randomUUID(), class_id: payload.classId, material_id: payload.materialId, title: payload.title, topic: payload.topic, num_questions: payload.numQuestions, difficulty: payload.difficulty, created_by: user.id, status: "draft" }).select("id,status").single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid assessment." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to create assessment." } }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).single();
  if (profile?.role === "teacher") {
    const { data } = await admin.from("assessments").select("*").eq("created_by", auth.user.id).order("created_at", { ascending: false });
    return NextResponse.json({ assessments: data ?? [] });
  }
  const { data: memberships } = await admin.from("class_members").select("class_id").eq("student_id", auth.user.id);
  const classIds = (memberships ?? []).map((item) => item.class_id);
  const { data } = classIds.length ? await admin.from("assessments").select("id,class_id,title,topic,status,opens_at,closes_at,attempt_limit").eq("status", "published").in("class_id", classIds) : { data: [] };
  const now = Date.now();
  return NextResponse.json({ assessments: (data ?? []).filter((item) => (!item.opens_at || new Date(item.opens_at).getTime() <= now) && (!item.closes_at || new Date(item.closes_at).getTime() > now)) });
}