import { z } from "zod";

import { aiMaterialSummarySchema } from "@/lib/validation";

/**
 * Ordered list of fallback models to try when the primary model is
 * overloaded (503) or quota-exhausted (429). All have been verified to
 * support `responseMimeType: "application/json"` via the Gemini REST API.
 *
 * The primary model can be overridden at runtime via GEMINI_MATERIAL_MODEL.
 */
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
];

function normalizeSummaryPayload(raw: unknown, defaultTopic: string) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawTitle = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "";
  const rawTopic = typeof obj.topic === "string" && obj.topic.trim() ? obj.topic.trim() : "";
  const rawSummary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : typeof obj.description === "string" && obj.description.trim()
      ? obj.description.trim()
      : "";

  const title = rawTitle || rawTopic || defaultTopic || "Learning Material";
  const topic = rawTopic || rawTitle || defaultTopic || "Educational Material";
  const summary = rawSummary || "Overview and key concepts extracted from the learning material.";
  const extractedText = typeof obj.extractedText === "string" ? obj.extractedText.trim() : undefined;

  let concepts: Array<{ name: string; accuracy: number }> = [];

  if (Array.isArray(obj.concepts)) {
    for (const item of obj.concepts) {
      if (typeof item === "string" && item.trim() && item.trim().toUpperCase() !== "N/A") {
        concepts.push({ name: item.trim(), accuracy: 0.9 });
      } else if (item && typeof item === "object") {
        const itemObj = item as Record<string, unknown>;
        const nameStr = String(itemObj.name || itemObj.concept || itemObj.title || "").trim();
        if (nameStr && nameStr.toUpperCase() !== "N/A") {
          const rawAcc = typeof itemObj.accuracy === "number" ? itemObj.accuracy : 0.9;
          const accuracy = Math.min(Math.max(Number.isFinite(rawAcc) ? rawAcc : 0.9, 0), 1);
          concepts.push({ name: nameStr, accuracy });
        }
      }
    }
  }

  // Ensure at least 1 valid concept is always present
  if (concepts.length === 0) {
    concepts.push({
      name: topic || title || "Core Learning Objective",
      accuracy: 0.85,
    });
  }

  return {
    title,
    topic,
    summary,
    extractedText,
    concepts,
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  image?: { mimeType: string; base64Data: string },
): Promise<{ ok: boolean; status: number; rawText: string | null; errorText?: string }> {
  let response: Response;
  const parts: Array<Record<string, unknown>> = [];

  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64Data,
      },
    });
  }

  parts.push({ text: prompt });

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(`Network error calling Gemini (${model}): ${message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { ok: false, status: response.status, rawText: null, errorText };
  }

  const json = await response.json();
  const rawText: string | null = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  return { ok: true, status: response.status, rawText };
}

export async function generateMaterialSummary(input: {
  topic: string;
  text?: string;
  image?: { mimeType: string; base64Data: string };
  apiKey?: string;
}) {
  const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  // Resolve candidate model list: env override first, then built-in fallbacks.
  const envModel = process.env.GEMINI_MATERIAL_MODEL;
  const candidates = envModel
    ? [envModel, ...FALLBACK_MODELS.filter((m) => m !== envModel)]
    : FALLBACK_MODELS;

  const prompt = input.image
    ? `You are an educational AI assistant generating a structured learning summary from an uploaded learning material image.
Analyze all visual and textual elements in the image (diagrams, text, handwriting, charts, formulas, headings, explanations).
Extract all readable text, labels, equations, and details from the image into the "extractedText" field.
Identify the core educational subject/topic.
Extract 1 to 5 key educational concepts covered, each with a confidence accuracy score between 0.1 and 1.0. Always provide at least one concept.

Return valid JSON in this exact shape:
{
  "title": "string",
  "topic": "string",
  "summary": "string",
  "extractedText": "all readable text, equations, and educational details from the image",
  "concepts": [{ "name": "string", "accuracy": 0.9 }]
}

Provided Title / Context: ${input.topic}`
    : `You are generating a structured learning summary for a classroom assessment.
Use only the provided material.
Extract 1 to 5 key educational concepts with confidence accuracy [0.1 to 1.0]. Always provide at least one concept.

Return valid JSON in this exact shape:
{
  "title": "string",
  "topic": "string",
  "summary": "string",
  "concepts": [{ "name": "string", "accuracy": 0.9 }]
}

Topic: ${input.topic}

Material:
${input.text ?? ""}`;

  // 404 is included because some API keys/tiers do not have access to specific preview models
  const retryableStatuses = new Set([404, 429, 500, 503]);
  let lastStatus = 0;
  let lastErrorText = "";

  for (const model of candidates) {
    const { ok, status, rawText, errorText } = await callGemini(apiKey, model, prompt, input.image);
    lastStatus = status;
    if (errorText) lastErrorText = errorText;

    if (ok) {
      if (!rawText) {
        // Model responded but returned no content — skip to next.
        console.warn(`Gemini model ${model} returned an empty payload; trying next model.`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        console.warn(`Gemini model ${model} returned invalid JSON; trying next model.`);
        continue;
      }

      // Normalize output to ensure it matches the schema shape cleanly
      const normalized = normalizeSummaryPayload(parsed, input.topic);
      if (!normalized) {
        console.warn(`Gemini model ${model} payload could not be normalized; trying next model.`);
        continue;
      }

      try {
        const result = aiMaterialSummarySchema.parse(normalized);
        return result;
      } catch (schemaError) {
        console.warn(`Gemini model ${model} output failed schema validation:`, schemaError);
        continue;
      }
    }

    if (retryableStatuses.has(status)) {
      // Quota or overload or unavailable — try the next fallback model.
      console.warn(`Gemini model ${model} returned HTTP ${status}; trying next fallback model.`);
      continue;
    }

    // Non-retryable error (e.g. 400 bad request)
    throw new Error(`Gemini request failed for model ${model}: HTTP ${status} ${lastErrorText}`);
  }

  // All candidates exhausted.
  throw new Error(
    `All Gemini model candidates are unavailable (last HTTP status: ${lastStatus}). Candidates tried: ${candidates.join(", ")}.`,
  );
}

export const geminiMaterialSummarySchema = z.object({
  title: z.string(),
  topic: z.string(),
  summary: z.string(),
  extractedText: z.string().optional(),
  concepts: z.array(
    z.object({
      name: z.string(),
      accuracy: z.number().min(0).max(1),
    }),
  ),
});
