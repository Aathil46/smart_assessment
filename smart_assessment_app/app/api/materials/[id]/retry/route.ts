import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

import { generateMaterialSummary } from "@/lib/gemini/material-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tempPath = path.join(os.tmpdir(), `smart-assessment-retry-${randomUUID()}.pdf`);

  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const { data: material, error: materialError } = await supabase
      .from("materials")
      .select("id, title, storage_path, class_id")
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
      throw new Error("The stored PDF could not be retrieved.");
    }

    await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
    const extraction = extractPdfText(tempPath);
    const text = extraction.chunks.map((chunk) => chunk.text).join("\n\n").trim();

    if (!text) {
      throw new Error("Insufficient extractable text in the PDF.");
    }

    const summary = await generateMaterialSummary({ topic: material.title, text });
    const { error: updateError } = await supabase
      .from("materials")
      .update({
        status: "processed",
        error_message: null,
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
      .eq("id", id);

    if (updateError) {
      throw new Error("Processed material could not be saved.");
    }

    return NextResponse.json({ id, status: "processed" });
  } catch (error) {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("materials")
      .update({
        status: "failed",
        error_message: "Material processing failed. Please try again.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    console.error("Material retry failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: { code: "PROCESSING_ERROR", message: "Material processing failed. Please try again." } }, { status: 500 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
