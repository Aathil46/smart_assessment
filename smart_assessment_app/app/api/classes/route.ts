import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classSchema } from "@/lib/validation";
import { generateClassCode } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ classes: data ?? [] });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = classSchema.parse(body);
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const profileResult = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileResult.error || profileResult.data?.role !== "teacher") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Teacher access required." } }, { status: 403 });
    }

    const code = generateClassCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({
        id: randomUUID(),
        teacher_id: userData.user.id,
        name: payload.name,
        subject: payload.subject || null,
        grade: payload.grade || null,
        code,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ id: data.id, code: data.code, name: data.name }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid class payload." } },
        { status: 400 },
      );
    }

    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}
