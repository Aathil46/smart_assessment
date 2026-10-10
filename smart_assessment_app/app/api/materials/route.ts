import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { generateMaterialSummary } from "@/lib/gemini/material-summary";
import { getTeacherGeminiApiKey } from "@/lib/gemini/teacher-credentials";
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

// ─── Helper: upload a single image buffer to Supabase storage ───────────────
async function uploadImageToStorage(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage
    .from("materials")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  return { error: error ? new Error(error.message) : null };
}

export async function POST(request: Request) {
  let tempFilePath: string | null = null;
  try {
    const formData = await request.formData();
    const classId = formData.get("classId");
    const title = formData.get("title");

    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    if (!classId || typeof classId !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A valid classId is required." } }, { status: 400 });
    }

    const { data: classRecord } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classId)
      .single();

    if (!classRecord || classRecord.teacher_id !== userData.user.id) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "You do not own this class." } }, { status: 403 });
    }

    // ─── MULTI-IMAGE GALLERY UPLOAD ──────────────────────────────────────────
    // Detect if this is a grouped image upload via `images[]` fields
    const imageFiles = formData.getAll("images[]") as unknown[];
    const validImageFiles = imageFiles.filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (validImageFiles.length > 0) {
      return await handleGalleryUpload({
        supabase,
        userId: userData.user.id,
        classId,
        classTeacherId: classRecord.teacher_id,
        imageFiles: validImageFiles,
        title: typeof title === "string" && title.trim() ? title.trim() : "Image Material",
      });
    }

    // ─── SINGLE-FILE UPLOAD (PDF / DOC / DOCX / single image — unchanged) ────
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A valid file or images[] are required." } }, { status: 400 });
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
      const teacherKey = await getTeacherGeminiApiKey(classRecord.teacher_id);
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
          apiKey: teacherKey,
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
            apiKey: teacherKey,
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
            apiKey: teacherKey,
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
            apiKey: teacherKey,
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

// ─── GALLERY UPLOAD HANDLER ──────────────────────────────────────────────────
async function handleGalleryUpload({
  supabase,
  userId,
  classId,
  classTeacherId,
  imageFiles,
  title,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  classId: string;
  classTeacherId: string;
  imageFiles: File[];
  title: string;
}): Promise<NextResponse> {
  const MAX_IMAGES = 20;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB per image
  const ALLOWED_IMAGE_EXTS = [".png", ".jpg", ".jpeg"];

  if (imageFiles.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: `Maximum ${MAX_IMAGES} images allowed per gallery material.` } },
      { status: 400 }
    );
  }

  // Validate each image
  for (const f of imageFiles) {
    const dotIdx = f.name.lastIndexOf(".");
    const ext = dotIdx !== -1 ? f.name.slice(dotIdx).toLowerCase() : "";
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: `File "${f.name}" is not a supported image. Use PNG, JPG, or JPEG.` } },
        { status: 400 }
      );
    }
    if (f.size <= 0 || f.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: `Image "${f.name}" must be non-empty and under 10MB.` } },
        { status: 400 }
      );
    }
  }

  // Upload all images to storage, keep ordered array
  const imagePages: Array<{ index: number; storagePath: string; originalName: string; mimeType: string }> = [];
  let totalSizeBytes = 0;
  const uploadedPaths: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    const dotIdx = f.name.lastIndexOf(".");
    const ext = dotIdx !== -1 ? f.name.slice(dotIdx).toLowerCase() : ".jpg";
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    const storagePath = `materials/${classTeacherId}/${classId}/${randomUUID()}${ext}`;

    const bytes = await f.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await uploadImageToStorage(supabase, buffer, storagePath, mimeType);
    if (uploadError) {
      // Clean up already uploaded images before returning
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("materials").remove(uploadedPaths).catch(() => undefined);
      }
      console.error(`Gallery upload failed for image ${i + 1}:`, uploadError);
      return NextResponse.json(
        { error: { code: "STORAGE_ERROR", message: `Failed to upload image ${i + 1} ("${f.name}"): ${uploadError.message}` } },
        { status: 500 }
      );
    }

    uploadedPaths.push(storagePath);
    imagePages.push({ index: i, storagePath, originalName: f.name, mimeType });
    totalSizeBytes += f.size;
  }

  // Create the single material record for the whole gallery
  const galleryFileName = `${title.replace(/[^a-zA-Z0-9._-]/g, "_")}.gallery`;
  const materialId = randomUUID();

  const { data: materialRecord, error: insertError } = await supabase
    .from("materials")
    .insert({
      id: materialId,
      class_id: classId,
      title,
      file_name: galleryFileName,
      // storage_path: use primary (first) image path for compatibility, full list is in metadata
      storage_path: imagePages[0].storagePath,
      mime_type: "image/gallery",
      size_bytes: totalSizeBytes,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !materialRecord) {
    // Clean up uploaded images
    await supabase.storage.from("materials").remove(uploadedPaths).catch(() => undefined);
    console.error("Gallery material DB insert failed:", insertError);
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: `Database save failed: ${insertError?.message ?? "Unknown error"}` } },
      { status: 500 }
    );
  }

  // Process images with Gemini — analyze all images and combine extracted text
  try {
    const allExtractedParts: string[] = [];
    let combinedSummary: {
      title: string;
      topic: string;
      summary: string;
      extractedText?: string;
      concepts: Array<{ name: string; accuracy: number }>;
    } | null = null;

    const teacherKey = await getTeacherGeminiApiKey(classTeacherId);
    for (let i = 0; i < imagePages.length; i++) {
      const page = imagePages[i];
      try {
        const { data: storedFile } = await supabase.storage.from("materials").download(page.storagePath);
        if (!storedFile) continue;

        const pageBuf = Buffer.from(await storedFile.arrayBuffer());
        const base64Data = pageBuf.toString("base64");

        const pageSummary = await generateMaterialSummary({
          topic: `${title} — Page ${i + 1}`,
          image: { mimeType: page.mimeType as "image/png" | "image/jpeg", base64Data },
          apiKey: teacherKey,
        });

        if (pageSummary?.extractedText) {
          allExtractedParts.push(`[Page ${i + 1}]\n${pageSummary.extractedText}`);
        } else if (pageSummary?.summary) {
          allExtractedParts.push(`[Page ${i + 1}]\n${pageSummary.summary}`);
        }

        // Use first successful summary as the primary combined summary
        if (!combinedSummary && pageSummary) {
          combinedSummary = pageSummary;
        } else if (combinedSummary && pageSummary) {
          // Merge concepts from subsequent pages
          const existingNames = new Set(combinedSummary.concepts.map((c) => c.name.toLowerCase()));
          for (const concept of pageSummary.concepts) {
            if (!existingNames.has(concept.name.toLowerCase())) {
              combinedSummary.concepts.push(concept);
              existingNames.add(concept.name.toLowerCase());
            }
          }
        }
      } catch (pageErr) {
        console.warn(`Gallery: failed to process image page ${i + 1}:`, pageErr);
        // Continue with remaining pages
      }
    }

    const combinedExtractedText = allExtractedParts.join("\n\n").trim();
    const isSuccess = Boolean(combinedSummary);

    if (combinedSummary && combinedExtractedText) {
      combinedSummary.extractedText = combinedExtractedText;
    }

    const { error: updateError } = await supabase
      .from("materials")
      .update({
        status: isSuccess ? "processed" : "failed",
        error_message: isSuccess ? null : "Unable to extract content from any of the uploaded images.",
        extracted_text: combinedExtractedText || null,
        page_count: imagePages.length,
        used_pages: imagePages.length,
        metadata: {
          fileType: "image_gallery",
          imagePages,
          pageCount: imagePages.length,
          aiSummary: combinedSummary,
          chunkCount: imagePages.length,
          truncated: false,
        },
        processed_at: new Date().toISOString(),
      })
      .eq("id", materialRecord.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json(
      {
        id: materialRecord.id,
        title: materialRecord.title,
        status: isSuccess ? "processed" : "failed",
        pageCount: imagePages.length,
        isGallery: true,
      },
      { status: 201 }
    );
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message : "Gallery processing failed.";
    console.error("Gallery processing failed:", { materialId: materialRecord.id, message });

    await supabase
      .from("materials")
      .update({ status: "failed", error_message: message, processed_at: new Date().toISOString() })
      .eq("id", materialRecord.id);

    return NextResponse.json(
      {
        id: materialRecord.id,
        title: materialRecord.title,
        status: "failed",
        errorMessage: message,
        pageCount: imagePages.length,
        isGallery: true,
      },
      { status: 201 }
    );
  }
}
