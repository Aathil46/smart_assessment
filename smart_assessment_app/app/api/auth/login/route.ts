import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = loginSchema.parse(body);

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error || !data.session) {
      throw new Error(error?.message ?? "Invalid email or password.");
    }

    // Fetch the authenticated user's role so the client can redirect correctly.
    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role: "teacher" | "student" | "principal" | null =
      (profile?.role as "teacher" | "student" | "principal") ?? null;

    return NextResponse.json({ ok: true, role }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input." } },
        { status: 400 },
      );
    }

    const response = toErrorResponse(error);
    return NextResponse.json(response, { status: 401 });
  }
}
