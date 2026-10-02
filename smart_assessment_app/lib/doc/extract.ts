import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

export type DocExtractionResult = {
  pageCount: number;
  usedPages: number;
  chunks: Array<{ page: number; text: string }>;
  hasEnoughText: boolean;
  truncated: boolean;
  text: string;
};

export function extractDocText(filePath: string): DocExtractionResult {
  const scriptPath = path.join(process.cwd(), "lib", "doc", "extract.py");

  if (!existsSync(scriptPath)) {
    throw new Error("DOC extraction script is missing.");
  }

  const result = spawnSync("python", [scriptPath, filePath], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`DOC extraction failed: ${result.error.message}`);
  }

  let parsed: {
    pageCount?: number;
    usedPages?: number;
    chunks?: Array<{ page: number; text: string }>;
    hasEnoughText?: boolean;
    text?: string;
    error?: string;
  } = {};

  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    const stderr = result.stderr?.trim() || "Unknown error parsing doc output";
    throw new Error(`DOC extraction failed: ${stderr}`);
  }

  if (parsed.error) {
    throw new Error(`DOC extraction failed: ${parsed.error}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || parsed.error || "Unknown Python error";
    throw new Error(`DOC extraction failed: ${stderr}`);
  }

  const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
  const text = (parsed.text ?? chunks.map((c) => c.text).join("\n\n")).trim();
  const pageCount = Number(parsed.pageCount ?? 1);
  const usedPages = Number(parsed.usedPages ?? 1);

  return {
    pageCount,
    usedPages,
    chunks,
    hasEnoughText: text.length > 50,
    truncated: false,
    text,
  };
}
