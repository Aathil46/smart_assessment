import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

import { generateMaterialSummary } from "@/lib/gemini/material-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { extractDocText } from "@/lib/doc/extract";
import { extractDocxText } from "@/lib/docx/extract";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let tempPath: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const { data: material, error: materialError } = await supabase
      .from("materials")
      .select("id, title, file_name, storage_path, mime_type, class_id")
      .eq("id", id)
      .single();

    if (materialError || !material) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Material not found." } }, { status: 404 });
    }

    const { data: ownedClass } = await supabase
      .from("classes")
      .select("id")
      .eq("id", material.class_id)
      .eq("teacher_id", userData.user.id)
      .single();

    if (!ownedClass) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied." } }, { status: 403 });
    }

    await supabase
      .from("materials")
      .update({ status: "processing", error_message: null })
      .eq("id", id);

    const { data: file, error: downloadError } = await supabase.storage
      .from("materials")
      .download(material.storage_path);

    if (downloadError || !file) {
      throw new Error("The stored material file could not be retrieved.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dotIdx = (material.storage_path || material.file_name || "").lastIndexOf(".");
    const ext = dotIdx !== -1 ? (material.storage_path || material.file_name).slice(dotIdx).toLowerCase() : ".pdf";
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
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      const base64Data = buffer.toString("base64");
      summary = await generateMaterialSummary({
        topic: material.title,
        image: { mimeType, base64Data },
      });
      extractedText = summary?.extractedText || `${summary?.title ?? material.title}\n\n${summary?.summary ?? ""}`.trim();
      pageCount = 1;
      usedPages = 1;
    } else if (isDocx) {
      const extraction = await extractDocxText(buffer);
      extractedText = extraction.text;
      pageCount = extraction.pageCount;
      usedPages = extraction.usedPages;
      chunkCount = extraction.chunks.length;
      truncated = extraction.truncated;

      if (extraction.hasEnoughText || extractedText.length > 20) {
        summary = await generateMaterialSummary({
          topic: material.title,
          text: extractedText,
        });
      } else {
        errorMessage = "Insufficient extractable text in the DOCX file.";
      }
    } else if (isDoc) {
      tempPath = path.join(os.tmpdir(), `smart-assessment-retry-${randomUUID()}.doc`);
      await writeFile(tempPath, buffer);
      const extraction = extractDocText(tempPath);
      extractedText = extraction.text;
      pageCount = extraction.pageCount;
      usedPages = extraction.usedPages;
      chunkCount = extraction.chunks.length;

      if (extraction.hasEnoughText || extractedText.length > 20) {
        summary = await generateMaterialSummary({
          topic: material.title,
          text: extractedText,
        });
      } else {
        errorMessage = "Insufficient extractable text in the DOC file.";
      }
    } else {
      tempPath = path.join(os.tmpdir(), `smart-assessment-retry-${randomUUID()}.pdf`);
      await writeFile(tempPath, buffer);
      const extraction = extractPdfText(tempPath);
      extractedText = extraction.chunks.map((chunk) => chunk.text).join("\n\n").trim();
      pageCount = extraction.pageCount;
      usedPages = extraction.usedPages;
      truncated = extraction.truncated;
      chunkCount = extraction.chunks.length;

      if (extraction.hasEnoughText || extractedText.length > 50) {
        summary = await generateMaterialSummary({
          topic: material.title,
          text: extractedText,
        });
      } else {
        errorMessage = "Insufficient extractable text in the PDF.";
      }
    }

    const isSuccess = Boolean(summary);
    const finalErrorMessage = isSuccess ? null : (errorMessage || "Material processing failed.");

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
      .eq("id", id);

    if (updateError) {
      throw new Error("Processed material could not be saved.");
    }

    return NextResponse.json({
      id,
      status: isSuccess ? "processed" : "failed",
      errorMessage: finalErrorMessage ?? undefined,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Material processing failed. Please try again.";
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("materials")
      .update({
        status: "failed",
        error_message: errorMsg,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    console.error("Material retry failed", errorMsg);
    return NextResponse.json(
      { error: { code: "PROCESSING_ERROR", message: errorMsg } },
      { status: 500 }
    );
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}
