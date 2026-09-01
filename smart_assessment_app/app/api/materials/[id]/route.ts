import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const { data, error: fetchError } = await supabase
      .from("materials")
      .select("*, classes(teacher_id)")
      .eq("id", id)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Material not found." } }, { status: 404 });
    }

    const teacherId = data.classes?.teacher_id;
    if (teacherId !== userData.user.id) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied." } }, { status: 403 });
    }

    return NextResponse.json({ material: data });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unable to fetch material." } }, { status: 500 });
  }
}
