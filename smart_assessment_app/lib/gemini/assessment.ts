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

export async function generateAssessmentQuestions(input: { topic: string; difficulty: string; count: number; material: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");
  const prompt = `Create ${input.count} multiple-choice questions using only this material. Return JSON array only. Every item must have text, choices (exactly four unique strings), correctAnswer (one choice), concept, and difficulty (${input.difficulty}). Topic: ${input.topic}\n\nMaterial:\n${input.material}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const json = await response.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no questions.");
  return generatedQuestionsSchema.parse(JSON.parse(raw));
}