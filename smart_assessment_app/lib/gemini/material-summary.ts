import { z } from "zod";

import { aiMaterialSummarySchema } from "@/lib/validation";

export async function generateMaterialSummary(input: { topic: string; text: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
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

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const json = await response.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned no JSON payload.");
  }

  const parsed = JSON.parse(rawText);
  const result = aiMaterialSummarySchema.parse(parsed);

  return result;
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
