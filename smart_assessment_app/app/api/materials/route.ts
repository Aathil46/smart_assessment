import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateMaterialSummary } from "@/lib/gemini/material-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";

export async function GET(request: Request) {
  const classId = new URL(request.url).searchParams.get("classId");
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  let classQuery = supabase.from("classes").select("id").eq("teacher_id", userData.user.id);
  if (classId) classQuery = classQuery.eq("id", classId);
  const { data: ownedClasses, error: classError } = await classQuery;
  if (classError) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unable to load classes." } }, { status: 500 });
  const ownedClassIds = (ownedClasses ?? []).map((item) => item.id);
  if (ownedClassIds.length === 0) return NextResponse.json({ materials: [] });
  const { data, error } = await supabase
    .from("materials")
    .select("id,class_id,title,file_name,mime_type,size_bytes,status,created_at,page_count,metadata")
    .in("class_id", ownedClassIds)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unable to load materials." } }, { status: 500 });
  return NextResponse.json({ materials: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const classId = formData.get("classId");
    const title = formData.get("title");

    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    if (!(file instanceof File) || !classId || typeof classId !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A valid PDF file and classId are required." } }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "Only PDF files are supported." } }, { status: 400 });
    }

    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "The PDF must be non-empty and under 20MB." } }, { status: 400 });
    }

    const { data: classRecord } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classId)
      .single();

    if (!classRecord || classRecord.teacher_id !== userData.user.id) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not own this class." } }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storagePath = `materials/${classRecord.teacher_id}/${classId}/${randomUUID()}.pdf`;

    const { error: storageError } = await supabase.storage
      .from("materials")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (storageError) {
      throw new Error(storageError.message);
    }

    const { data: materialRecord, error: insertError } = await supabase
      .from("materials")
      .insert({
        id: randomUUID(),
        class_id: classId,
        title: typeof title === "string" && title.trim() ? title.trim() : file.name,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        status: "processing",
      })
      .select()
      .single();

    if (insertError || !materialRecord) {
      throw new Error(insertError?.message ?? "Material metadata could not be saved.");
    }

    const tempPath = `${process.cwd()}/tmp-${randomUUID()}.pdf`;
    try {
      await import("fs/promises").then((fs) => fs.writeFile(tempPath, buffer));
      const extraction = extractPdfText(tempPath);
      const text = extraction.chunks.map((chunk) => chunk.text).join("\n\n").trim();
      const summary = extraction.hasEnoughText
        ? await generateMaterialSummary({ topic: typeof title === "string" ? title : file.name, text })
        : null;

      const { error: updateError } = await supabase
        .from("materials")
        .update({
          status: summary ? "processed" : "failed",
          error_message: summary ? null : "Insufficient extractable text in the PDF.",
          extracted_text: text,
          page_count: extraction.pageCount,
          used_pages: extraction.usedPages,
          metadata: {
            truncated: extraction.truncated,
            chunkCount: extraction.chunks.length,
            aiSummary: summary,
          },
          processed_at: new Date().toISOString(),
        })
        .eq("id", materialRecord.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return NextResponse.json({
        id: materialRecord.id,
        title: materialRecord.title,
        status: summary ? "processed" : "failed",
        pageCount: extraction.pageCount,
      }, { status: 201 });
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "Material processing failed.";
      console.error("Material processing failed", {
        materialId: materialRecord.id,
        classId,
        message,
      });
      await supabase
        .from("materials")
        .update({
          status: "failed",
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", materialRecord.id);

      throw processingError;
    } finally {
      await import("fs/promises").then((fs) => fs.unlink(tempPath).catch(() => undefined));
    }
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

