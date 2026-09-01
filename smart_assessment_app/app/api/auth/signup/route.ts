import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const signupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["teacher", "student"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = signupSchema.parse(body);

    const admin = createAdminSupabaseClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { name: payload.name, role: payload.role },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Unable to create user account.");
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: authData.user.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    return NextResponse.json(
      { userId: authData.user.id, role: payload.role },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input." } },
        { status: 400 },
      );
    }

    const response = toErrorResponse(error);
    return NextResponse.json(response, { status: 400 });
  }
}
