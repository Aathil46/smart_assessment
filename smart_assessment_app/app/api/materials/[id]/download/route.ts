import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });

  const { data: material } = await supabase
    .from("materials")
    .select("id,file_name,storage_path,classes!inner(teacher_id)")
    .eq("id", id)
    .eq("classes.teacher_id", userData.user.id)
    .single();
  if (!material) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Material not found." } }, { status: 404 });

  const { data: file, error } = await supabase.storage.from("materials").download(material.storage_path);
  if (error || !file) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Stored material could not be downloaded." } }, { status: 404 });

  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": file.type || "application/pdf",
      "Content-Disposition": `attachment; filename="${material.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    },
  });
}