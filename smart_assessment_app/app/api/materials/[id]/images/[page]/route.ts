import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/materials/[id]/images/[page]
 *
 * Serves a single image from a gallery material.
 * `page` is 0-indexed (page=0 is the first image).
 *
 * Works for both teachers (class owner) and students (class member).
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; page: string }> }
) {
  try {
    const { id, page } = await params;
    const pageIndex = parseInt(page, 10);

    if (isNaN(pageIndex) || pageIndex < 0) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid page index." } }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    // Fetch material — allow access for both teachers (class owner) and students (class member)
    const { data: material, error: fetchError } = await supabase
      .from("materials")
      .select("id,mime_type,metadata,class_id")
      .eq("id", id)
      .single();

    if (fetchError || !material) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Material not found." } }, { status: 404 });
    }

    // Authorize: teacher owns the class OR student is a member of the class
    const { data: classRecord } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", material.class_id)
      .single();

    const isTeacher = classRecord?.teacher_id === userData.user.id;
    if (!isTeacher) {
      // Check if the user is a student in this class
      const { data: membership } = await supabase
        .from("class_members")
        .select("student_id")
        .eq("class_id", material.class_id)
        .eq("student_id", userData.user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied." } }, { status: 403 });
      }
    }

    if (material.mime_type !== "image/gallery") {
      return NextResponse.json(
        { error: { code: "INVALID_OPERATION", message: "This material is not an image gallery." } },
        { status: 400 }
      );
    }

    const imagePages = (material.metadata as { imagePages?: Array<{ index: number; storagePath: string; mimeType: string }> })
      ?.imagePages ?? [];

    // Find by index
    const imagePage = imagePages.find((p) => p.index === pageIndex);
    if (!imagePage) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: `Page ${pageIndex} not found in this gallery.` } }, { status: 404 });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("materials")
      .download(imagePage.storagePath);

    if (downloadError || !file) {
      return NextResponse.json(
        { error: { code: "STORAGE_ERROR", message: "Image could not be retrieved." } },
        { status: 500 }
      );
    }

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": imagePage.mimeType || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to serve gallery image." } },
      { status: 500 }
    );
  }
}
