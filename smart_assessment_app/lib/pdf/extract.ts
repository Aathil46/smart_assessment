import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const MAX_PAGES = 25;

export type PdfExtractionResult = {
  pageCount: number;
  usedPages: number;
  chunks: Array<{ page: number; text: string }>;
  hasEnoughText: boolean;
  truncated: boolean;
};

export function extractPdfText(filePath: string): PdfExtractionResult {
  const scriptPath = path.join(process.cwd(), "lib", "pdf", "extract.py");

  if (!existsSync(scriptPath)) {
    throw new Error("PDF extraction script is missing.");
  }

  const result = spawnSync("python", [scriptPath, filePath], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`PDF extraction failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "Unknown Python error";
    throw new Error(`PDF extraction failed: ${stderr}`);
  }

  const parsed = JSON.parse(result.stdout || "{}") as {
    pageCount?: number;
    usedPages?: number;
    chunks?: Array<{ page: number; text: string }>;
  };

  const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
  const text = chunks.map((chunk) => chunk.text).join("\n\n").trim();
  const pageCount = Number(parsed.pageCount ?? chunks.length ?? 0);
  const usedPages = Number(parsed.usedPages ?? Math.min(pageCount, MAX_PAGES));

  return {
    pageCount,
    usedPages,
    chunks,
    hasEnoughText: text.length > 200,
    truncated: pageCount > MAX_PAGES,
  };
}
