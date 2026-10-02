import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateMaterialSummary } from "@/lib/gemini/material-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocText } from "@/lib/doc/extract";
import { extractDocxText } from "@/lib/docx/extract";
import { isAllowedMaterialFile } from "@/lib/validation";

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
    .select("id,class_id,title,file_name,mime_type,size_bytes,status,created_at,page_count,metadata,error_message")
    .in("class_id", ownedClassIds)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unable to load materials." } }, { status: 500 });
  return NextResponse.json({ materials: data ?? [] });
}

export async function POST(request: Request) {
  let tempFilePath: string | null = null;
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
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A valid file and classId are required." } }, { status: 400 });
    }

    if (!isAllowedMaterialFile(file.name, file.type)) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "Supported formats are PDF, DOC, DOCX, PNG, JPG, and JPEG." } },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "The file must be non-empty and under 20MB." } }, { status: 400 });
    }

    const { data: classRecord } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classId)
      .single();

    if (!classRecord || classRecord.teacher_id !== userData.user.id) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not own this class." } }, { status: 403 });
    }

    const dotIdx = file.name.lastIndexOf(".");
    const ext = dotIdx !== -1 ? file.name.slice(dotIdx).toLowerCase() : ".pdf";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storagePath = `materials/${classRecord.teacher_id}/${classId}/${randomUUID()}${ext}`;

    const normalizedMime =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".doc"
        ? "application/msword"
        : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : file.type || "application/octet-stream";

    const { error: storageError } = await supabase.storage
      .from("materials")
      .upload(storagePath, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload failed:", storageError);
      return NextResponse.json(
        {
          error: {
            code: "STORAGE_ERROR",
            message: `Storage upload failed: ${storageError.message}`,
          },
        },
        { status: 500 }
      );
    }

    const materialTitle = typeof title === "string" && title.trim() ? title.trim() : file.name;

    const { data: materialRecord, error: insertError } = await supabase
      .from("materials")
      .insert({
        id: randomUUID(),
        class_id: classId,
        title: materialTitle,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: normalizedMime,
        size_bytes: file.size,
        status: "processing",
      })
      .select()
      .single();

    if (insertError || !materialRecord) {
      console.error("Database save failed:", insertError);
      return NextResponse.json(
        {
          error: {
            code: "DATABASE_ERROR",
            message: `Database save failed: ${insertError?.message ?? "Could not save material"}`,
          },
        },
        { status: 500 }
      );
    }

    try {
      const isImage = ext === ".png" || ext === ".jpg" || ext === ".jpeg";
      const isDoc = ext === ".doc";
      const isDocx = ext === ".docx";

      let extractedText = "";
      let pageCount = 1;
      let usedPages = 1;
      let truncated = false;
      let chunkCount = 1;
      let summary: { title: string; topic: string; summary: string; extractedText?: string; concepts: Array<{ name: string; accuracy: number }> } | null = null;
      let errorMessage: string | null = null;

      if (isImage) {
        // Send the actual image content to Gemini vision/multimodal processing
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        const base64Data = buffer.toString("base64");
        summary = await generateMaterialSummary({
          topic: materialTitle,
          image: { mimeType, base64Data },
        });

        extractedText = summary?.extractedText || `${summary?.title ?? materialTitle}\n\n${summary?.summary ?? ""}`.trim();
        pageCount = 1;
        usedPages = 1;
      } else if (isDocx) {
        // Extract text from modern .docx
        const extraction = await extractDocxText(buffer);
        extractedText = extraction.text;
        pageCount = extraction.pageCount;
        usedPages = extraction.usedPages;
        chunkCount = extraction.chunks.length;
        truncated = extraction.truncated;

        if (extraction.hasEnoughText || extractedText.length > 20) {
          summary = await generateMaterialSummary({
            topic: materialTitle,
            text: extractedText,
          });
        } else {
          errorMessage = "Insufficient extractable text in the DOCX file.";
        }
      } else if (isDoc) {
        // Extract text from legacy .doc
        tempFilePath = path.join(os.tmpdir(), `smart-assessment-${randomUUID()}.doc`);
        await writeFile(tempFilePath, buffer);
        const extraction = extractDocText(tempFilePath);
        extractedText = extraction.text;
        pageCount = extraction.pageCount;
        usedPages = extraction.usedPages;
        chunkCount = extraction.chunks.length;

        if (extraction.hasEnoughText || extractedText.length > 20) {
          summary = await generateMaterialSummary({
            topic: materialTitle,
            text: extractedText,
          });
        } else {
          errorMessage = "Insufficient extractable text in the DOC file.";
        }
      } else {
        // PDF processing (preserved exactly)
        tempFilePath = path.join(os.tmpdir(), `smart-assessment-${randomUUID()}.pdf`);
        await writeFile(tempFilePath, buffer);
        const extraction = extractPdfText(tempFilePath);
        extractedText = extraction.chunks.map((chunk) => chunk.text).join("\n\n").trim();
        pageCount = extraction.pageCount;
        usedPages = extraction.usedPages;
        truncated = extraction.truncated;
        chunkCount = extraction.chunks.length;

        if (extraction.hasEnoughText || extractedText.length > 50) {
          summary = await generateMaterialSummary({
            topic: materialTitle,
            text: extractedText,
          });
        } else {
          errorMessage = "Insufficient extractable text in the PDF.";
        }
      }

      const isSuccess = Boolean(summary);

      const finalErrorMessage = isSuccess ? null : (errorMessage || "Unable to extract concepts from this material.");

      const { error: updateError } = await supabase
        .from("materials")
        .update({
          status: isSuccess ? "processed" : "failed",
          error_message: finalErrorMessage,
          extracted_text: extractedText,
          page_count: pageCount,
          used_pages: usedPages,
          metadata: {
            fileType: isImage ? "image" : isDocx ? "docx" : isDoc ? "doc" : "pdf",
            truncated,
            chunkCount,
            aiSummary: summary,
          },
          processed_at: new Date().toISOString(),
        })
        .eq("id", materialRecord.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return NextResponse.json(
        {
          id: materialRecord.id,
          title: materialRecord.title,
          status: isSuccess ? "processed" : "failed",
          errorMessage: finalErrorMessage ?? undefined,
          pageCount,
        },
        { status: 201 }
      );
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

      return NextResponse.json(
        {
          id: materialRecord.id,
          title: materialRecord.title,
          status: "failed",
          errorMessage: message,
          pageCount: 1,
        },
        { status: 201 }
      );
    } finally {
      if (tempFilePath) {
        await unlink(tempFilePath).catch(() => undefined);
      }
    }
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}


