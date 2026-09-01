import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { joinClassSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { code } = joinClassSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "Student access required." } }, { status: 403 });
    const { data: klass } = await admin.from("classes").select("id,name").ilike("code", code).single();
    if (!klass) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Class code not found." } }, { status: 404 });
    const { error } = await admin.from("class_members").upsert({ class_id: klass.id, student_id: auth.user.id }, { onConflict: "class_id,student_id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ classId: klass.id, name: klass.name });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Enter a six-character class code." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to join class." } }, { status: 500 });
  }
}