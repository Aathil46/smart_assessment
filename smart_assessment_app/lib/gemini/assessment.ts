import { z } from "zod";

import { difficultySchema } from "@/lib/validation";

const generatedQuestionSchema = z.object({
  text: z.string().min(1),
  choices: z.array(z.string().min(1)).length(4),
  correctAnswer: z.string().min(1),
  concept: z.string().min(1),
  difficulty: difficultySchema,
});

export const generatedQuestionsSchema = z.array(generatedQuestionSchema).min(1).max(20);

const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

export async function generateAssessmentQuestions(input: { topic: string; difficulty: string; count: number; material: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");

  const primary = process.env.GEMINI_ASSESSMENT_MODEL || "gemini-3.7-flash";
  const modelsToTry = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  const prompt = `Create ${input.count} multiple-choice questions using only this material. Return JSON array only. Every item must have text, choices (exactly four unique strings), correctAnswer (one choice), concept, and difficulty (${input.difficulty}). Topic: ${input.topic}\n\nMaterial:\n${input.material}`;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });

      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          console.warn(`[Gemini Assessment] Model ${model} returned ${response.status}. Trying next fallback...`);
          lastError = new Error(`Gemini request failed (${model}): ${response.status}`);
          continue;
        }
        throw new Error(`Gemini request failed (${model}): ${response.status}`);
      }

      const json = await response.json();
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        lastError = new Error(`Gemini (${model}) returned no questions.`);
        continue;
      }

      return generatedQuestionsSchema.parse(JSON.parse(raw));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini Assessment] Error with ${model}: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("All Gemini models failed to generate questions.");
}