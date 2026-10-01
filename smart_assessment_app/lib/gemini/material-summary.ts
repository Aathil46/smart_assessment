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
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ ok: boolean; status: number; rawText: string | null }> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
    return { ok: false, status: response.status, rawText: null };
  }

  const json = await response.json();
  const rawText: string | null = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  return { ok: true, status: response.status, rawText };
}

export async function generateMaterialSummary(input: { topic: string; text: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  // Resolve candidate model list: env override first, then built-in fallbacks.
  const envModel = process.env.GEMINI_MATERIAL_MODEL;
  const candidates = envModel
    ? [envModel, ...FALLBACK_MODELS.filter((m) => m !== envModel)]
    : FALLBACK_MODELS;

  const prompt = `You are generating a structured learning summary for a classroom assessment.
Use only the provided material.

Return valid JSON in this exact shape:
{
  "title": "string",
  "topic": "string",
  "summary": "string",
  "concepts": [{ "name": "string", "accuracy": 0.0 }]
}

Topic: ${input.topic}

Material:
${input.text}`;

  const retryableStatuses = new Set([429, 500, 503]);
  let lastStatus = 0;

  for (const model of candidates) {
    const { ok, status, rawText } = await callGemini(apiKey, model, prompt);
    lastStatus = status;

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

      // Validate against the strict schema.
      const result = aiMaterialSummarySchema.parse(parsed);
      return result;
    }

    if (retryableStatuses.has(status)) {
      // Quota or overload — try the next fallback model.
      console.warn(`Gemini model ${model} returned HTTP ${status}; trying next fallback model.`);
      continue;
    }

    // Non-retryable error (e.g. 400 bad request, 404 model not found).
    throw new Error(`Gemini request failed for model ${model}: HTTP ${status}`);
  }

  // All candidates exhausted.
  throw new Error(
    `All Gemini model candidates are unavailable (last HTTP status: ${lastStatus}). ` +
      `Candidates tried: ${candidates.join(", ")}.`,
  );
}

export const geminiMaterialSummarySchema = z.object({
  title: z.string(),
  topic: z.string(),
  summary: z.string(),
  concepts: z.array(
    z.object({
      name: z.string(),
      accuracy: z.number().min(0).max(1),
    }),
  ),
});
