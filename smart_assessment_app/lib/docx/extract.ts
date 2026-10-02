import fs from "fs";
import JSZip from "jszip";

export type DocxExtractionResult = {
  pageCount: number;
  usedPages: number;
  chunks: Array<{ page: number; text: string }>;
  hasEnoughText: boolean;
  truncated: boolean;
  text: string;
};

/**
 * Decode common XML entities in Word XML text nodes.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract paragraph text from WordprocessingML XML (e.g. document.xml).
 */
function extractTextFromWordXml(xmlContent: string): string {
  const paragraphs: string[] = [];

  // Match all paragraphs <w:p ...>...</w:p>
  const paragraphRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = paragraphRegex.exec(xmlContent)) !== null) {
    const pBody = pMatch[1];

    // Handle line breaks and tabs within this paragraph
    let cleanBody = pBody
      .replace(/<w:br(?:\s+[^>]*)?\/>/g, "\n")
      .replace(/<w:cr(?:\s+[^>]*)?\/>/g, "\n")
      .replace(/<w:tab(?:\s+[^>]*)?\/>/g, "\t");

    // Extract text runs: <w:t ...>text</w:t>
    const textRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let paragraphText = "";

    while ((tMatch = textRegex.exec(cleanBody)) !== null) {
      paragraphText += tMatch[1];
    }

    const decoded = decodeXmlEntities(paragraphText).trim();
    if (decoded) {
      paragraphs.push(decoded);
    }
  }

  // If regex found no paragraphs (unusual formatting), fallback to extracting all <w:t> tags
  if (paragraphs.length === 0) {
    const fallbackRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let fallbackText = "";

    while ((tMatch = fallbackRegex.exec(xmlContent)) !== null) {
      fallbackText += tMatch[1] + " ";
    }

    const decodedFallback = decodeXmlEntities(fallbackText).trim();
    if (decodedFallback) {
      paragraphs.push(decodedFallback);
    }
  }

  return paragraphs.join("\n\n");
}

/**
 * Extract text and metadata from a DOCX file buffer or path.
 */
export async function extractDocxText(source: string | Buffer): Promise<DocxExtractionResult> {
  const buffer = typeof source === "string" ? await fs.promises.readFile(source) : source;

  if (buffer.length === 0) {
    throw new Error("DOCX file is empty.");
  }

  // Check magic bytes:
  // OLE Compound Document (legacy .doc): D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    throw new Error(
      "The file appears to be a legacy binary .doc file, not a modern .docx. Please upload it as a .doc file."
    );
  }

  // ZIP header check: PK\x03\x04 or PK\x05\x06 (empty archive)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("Invalid .docx file: missing standard ZIP header.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (zipError) {
    const msg = zipError instanceof Error ? zipError.message : String(zipError);
    throw new Error(`Failed to parse DOCX archive: ${msg}`);
  }

  // Primary document body
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid .docx file: word/document.xml not found inside package.");
  }

  const documentXml = await docFile.async("text");
  let combinedText = extractTextFromWordXml(documentXml);

  // Optional: check footnotes or endnotes
  const footnotesFile = zip.file("word/footnotes.xml");
  if (footnotesFile) {
    try {
      const fnXml = await footnotesFile.async("text");
      const fnText = extractTextFromWordXml(fnXml);
      if (fnText) combinedText += `\n\n${fnText}`;
    } catch {
      // Ignore footnotes read failure
    }
  }

  // Estimate or extract page count from docProps/app.xml
  let pageCount = 1;
  const appPropsFile = zip.file("docProps/app.xml");
  if (appPropsFile) {
    try {
      const appXml = await appPropsFile.async("text");
      const pageMatch = /<Pages>(\d+)<\/Pages>/i.exec(appXml);
      if (pageMatch && parseInt(pageMatch[1], 10) > 0) {
        pageCount = parseInt(pageMatch[1], 10);
      }
    } catch {
      // Fallback below
    }
  }

  // If docProps/app.xml didn't provide pages, estimate based on length (~2000 chars per page)
  if (pageCount <= 1 && combinedText.length > 2500) {
    pageCount = Math.max(1, Math.ceil(combinedText.length / 2000));
  }

  // Split into chunks of ~1500 chars (matching PDF chunking pattern)
  const paragraphs = combinedText.split(/\n\n+/).filter(Boolean);
  const chunks: Array<{ page: number; text: string }> = [];
  let currentChunk = "";
  let currentPage = 1;

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > 1500 && currentChunk.length > 0) {
      chunks.push({ page: currentPage, text: currentChunk.trim() });
      currentPage++;
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ page: currentPage, text: currentChunk.trim() });
  }

  return {
    pageCount: Math.max(pageCount, chunks.length || 1),
    usedPages: Math.max(pageCount, chunks.length || 1),
    chunks,
    hasEnoughText: combinedText.length > 50,
    truncated: false,
    text: combinedText.trim(),
  };
}
