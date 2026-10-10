import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  maskApiKey,
  saveTeacherGeminiApiKey,
  removeTeacherGeminiApiKey,
} from "@/lib/gemini/teacher-credentials";

const saveKeySchema = z.object({
  apiKey: z.string().trim().min(5, "API key must be at least 5 characters."),
});

/**
 * GET /api/teacher/credentials
 * Returns masked credentials status for the authenticated teacher.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, gemini_api_key")
      .eq("id", auth.user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    const rawKey = profile.gemini_api_key;
    const hasKey = Boolean(rawKey && typeof rawKey === "string" && rawKey.trim());

    return NextResponse.json({
      hasKey,
      status: hasKey ? "Connected" : "Not Configured",
      maskedKey: hasKey ? maskApiKey(rawKey) : null,
    });
  } catch (error) {
    console.error("[Credentials GET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load credentials." } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/credentials
 * Securely saves teacher's personal Gemini API key.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = saveKeySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Invalid API key.",
          },
        },
        { status: 400 }
      );
    }

    const key = parseResult.data.apiKey;
    await saveTeacherGeminiApiKey(auth.user.id, key);

    return NextResponse.json({
      ok: true,
      hasKey: true,
      status: "Connected",
      maskedKey: maskApiKey(key),
    });
  } catch (error) {
    console.error("[Credentials POST] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to save API key.",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teacher/credentials
 * Removes the teacher's personal Gemini API key (reverting to system fallback).
 */
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    await removeTeacherGeminiApiKey(auth.user.id);

    return NextResponse.json({
      ok: true,
      hasKey: false,
      status: "Not Configured",
      maskedKey: null,
    });
  } catch (error) {
    console.error("[Credentials DELETE] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to remove API key.",
        },
      },
      { status: 500 }
    );
  }
}
