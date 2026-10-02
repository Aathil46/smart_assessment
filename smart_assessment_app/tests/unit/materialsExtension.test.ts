import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";

import { isAllowedMaterialFile, aiMaterialSummarySchema } from "@/lib/validation";
import { extractDocText } from "@/lib/doc/extract";
import { extractDocxText } from "@/lib/docx/extract";
import { generateMaterialSummary } from "@/lib/gemini/material-summary";

describe("Materials File Type Validation", () => {
  it("allows supported file types: PDF, PNG, JPG, JPEG, DOC, and DOCX", () => {
    expect(isAllowedMaterialFile("notes.pdf", "application/pdf")).toBe(true);
    expect(isAllowedMaterialFile("diagram.png", "image/png")).toBe(true);
    expect(isAllowedMaterialFile("photo.jpg", "image/jpeg")).toBe(true);
    expect(isAllowedMaterialFile("photo.jpeg", "image/jpeg")).toBe(true);
    expect(isAllowedMaterialFile("lecture.doc", "application/msword")).toBe(true);
    expect(isAllowedMaterialFile("lecture.doc", "application/octet-stream")).toBe(true);
    expect(
      isAllowedMaterialFile(
        "thesis.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(isAllowedMaterialFile("thesis.docx", "application/octet-stream")).toBe(true);
  });

  it("rejects unsupported file types (including .txt, .exe, .mp4, etc.)", () => {
    expect(isAllowedMaterialFile("notes.txt", "text/plain")).toBe(false);
    expect(isAllowedMaterialFile("app.exe", "application/x-msdownload")).toBe(false);
    expect(isAllowedMaterialFile("video.mp4", "video/mp4")).toBe(false);
    expect(isAllowedMaterialFile("archive.zip", "application/zip")).toBe(false);
  });

  it("validates aiMaterialSummarySchema with multimodal extractedText", () => {
    const validWithExtracted = {
      title: "Cell Division",
      topic: "Mitosis",
      summary: "Overview of cell division stages.",
      extractedText: "Prophase, Metaphase, Anaphase, Telophase.",
      concepts: [
        { name: "Mitosis", accuracy: 0.9 },
        { name: "Cytokinesis", accuracy: 0.8 },
      ],
    };

    const parsed = aiMaterialSummarySchema.parse(validWithExtracted);
    expect(parsed.extractedText).toBe("Prophase, Metaphase, Anaphase, Telophase.");
    expect(parsed.concepts).toHaveLength(2);
  });
});

describe("DOC Extraction", () => {
  it("extracts text from RTF-based .doc files", () => {
    const tempPath = path.join(os.tmpdir(), `test-rtf-${Date.now()}.doc`);
    const rtfContent = Buffer.from(
      "{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Courier;}} Fundamental Concepts of Calculus and Limits for Advanced Mathematics.\\par Second paragraph detailing derivatives and integrals.}"
    );

    try {
      fs.writeFileSync(tempPath, rtfContent);
      const result = extractDocText(tempPath);
      expect(result.text).toContain("Fundamental Concepts of Calculus and Limits");
      expect(result.text).toContain("Second paragraph detailing derivatives");
      expect(result.hasEnoughText).toBe(true);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it("rejects modern .docx ZIP files renamed as .doc with clear error", () => {
    const tempPath = path.join(os.tmpdir(), `test-fake-${Date.now()}.doc`);
    const fakeZipHeader = Buffer.from("PK\x03\x04\x14\x00\x00\x00 fake docx zip content");

    try {
      fs.writeFileSync(tempPath, fakeZipHeader);
      expect(() => extractDocText(tempPath)).toThrow(/modern \.docx/i);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });
});

describe("DOCX Extraction", () => {
  it("extracts text and paragraphs from valid .docx package", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Cellular Respiration and ATP Production in Mitochondria.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Glycolysis occurs in the cytoplasm and breaks down glucose &amp; produces pyruvate.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const result = await extractDocxText(buffer);
    expect(result.text).toContain("Cellular Respiration and ATP Production in Mitochondria.");
    expect(result.text).toContain("Glycolysis occurs in the cytoplasm and breaks down glucose & produces pyruvate.");
    expect(result.hasEnoughText).toBe(true);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("rejects legacy binary .doc masquerading as .docx with clear error", async () => {
    // OLE Compound Document signature
    const fakeOleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    await expect(extractDocxText(fakeOleHeader)).rejects.toThrow(/legacy binary \.doc/i);
  });

  it("rejects non-zip files passed as .docx", async () => {
    const invalidBuffer = Buffer.from("This is plain text pretending to be docx.");
    await expect(extractDocxText(invalidBuffer)).rejects.toThrow(/missing standard ZIP header/i);
  });
});

describe("Gemini Multimodal Image Processing & Normalization", () => {
  it("sends image inlineData and prompt to Gemini vision API", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const originalFetch = globalThis.fetch;
    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "Photosynthesis Diagram",
                  topic: "Plant Biology",
                  summary: "Diagram illustrating light reactions and the Calvin cycle.",
                  extractedText: "Light reactions occur in thylakoid membranes. Calvin cycle occurs in stroma.",
                  concepts: [
                    { name: "Light Reactions", accuracy: 0.95 },
                    { name: "Calvin Cycle", accuracy: 0.9 },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    let capturedRequestBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        capturedRequestBody = JSON.parse(init.body as string);
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockResponsePayload,
      } as Response;
    });

    try {
      const summary = await generateMaterialSummary({
        topic: "Biology Diagram",
        image: {
          mimeType: "image/png",
          base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      });

      expect(summary.title).toBe("Photosynthesis Diagram");
      expect(summary.concepts).toHaveLength(2);

      // Verify that inlineData with image was sent to Gemini
      const parts = capturedRequestBody?.contents?.[0]?.parts;
      expect(parts).toBeDefined();
      expect(parts[0].inlineData).toBeDefined();
      expect(parts[0].inlineData.mimeType).toBe("image/png");
      expect(parts[0].inlineData.data).toContain("iVBORw0KGgoAAAANSUhEUg");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes concepts if Gemini returns string array or empty concepts", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const originalFetch = globalThis.fetch;
    const mockStringConceptsPayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "Rock Cycle Diagram",
                  topic: "Geology",
                  summary: "Diagram showing igneous, sedimentary, and metamorphic transitions.",
                  extractedText: "Sedimentary, Metamorphic, Igneous",
                  concepts: ["Sedimentary Rocks", "Metamorphic Rocks", "Igneous Rocks"],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockStringConceptsPayload,
      } as Response;
    });

    try {
      const summary = await generateMaterialSummary({
        topic: "Rocks and Minerals",
        image: {
          mimeType: "image/jpeg",
          base64Data: "abc123==",
        },
      });

      expect(summary.concepts).toHaveLength(3);
      expect(summary.concepts[0]).toEqual({ name: "Sedimentary Rocks", accuracy: 0.9 });
      expect(summary.concepts[1]).toEqual({ name: "Metamorphic Rocks", accuracy: 0.9 });
      expect(summary.concepts[2]).toEqual({ name: "Igneous Rocks", accuracy: 0.9 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("synthesizes concept if Gemini returns an empty concepts array", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const originalFetch = globalThis.fetch;
    const mockEmptyConceptsPayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "Rock Identification",
                  topic: "Geology",
                  summary: "Visual guide to identifying mineral grain structures.",
                  extractedText: "",
                  concepts: [],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockEmptyConceptsPayload,
      } as Response;
    });

    try {
      const summary = await generateMaterialSummary({
        topic: "Rock Identification",
        image: {
          mimeType: "image/jpeg",
          base64Data: "abc123==",
        },
      });

      expect(summary.concepts.length).toBeGreaterThanOrEqual(1);
      expect(summary.concepts[0].name).toBe("Geology");
      expect(summary.concepts[0].accuracy).toBe(0.85);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
