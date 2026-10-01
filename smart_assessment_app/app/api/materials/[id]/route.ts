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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });

  const { data: material } = await supabase
    .from("materials")
    .select("id,storage_path,classes!inner(teacher_id)")
    .eq("id", id)
    .eq("classes.teacher_id", userData.user.id)
    .single();
  if (!material) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Material not found." } }, { status: 404 });

  const { error: storageError } = await supabase.storage.from("materials").remove([material.storage_path]);
  if (storageError) return NextResponse.json({ error: { code: "STORAGE_ERROR", message: "Material file could not be deleted." } }, { status: 500 });
  const { error: deleteError } = await supabase.from("materials").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Material record could not be deleted." } }, { status: 500 });
  return NextResponse.json({ ok: true });
}
