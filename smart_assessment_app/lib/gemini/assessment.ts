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

export async function generateAssessmentQuestions(input: {
  topic: string;
  difficulty: string;
  count: number;
  material: string;
  instructions?: string;
  apiKey?: string;
}) {
  const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");

  const primary = process.env.GEMINI_ASSESSMENT_MODEL || "gemini-3.7-flash";
  const modelsToTry = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  const additionalInstructions = input.instructions?.trim()
    ? `\n\nAdditional Instructions:\n${input.instructions.trim()}`
    : "";

  const prompt = `Generate ${input.count} MCQs from the material only.

Rules:
- Mix theory and scenario/application questions; target ~50/50 when appropriate.
- Use scenarios only when a concept supports a meaningful application; never force one.
- Scenarios must test understanding/application, prediction, cause-effect, or decision-making, not sentence recall.
- Match difficulty: ${input.difficulty}.
- Exactly 4 plausible choices, 1 correct answer.
- Include concept and difficulty for each question.
- Return JSON array only.${additionalInstructions}

Topic: ${input.topic}

Material:
${input.material}`;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              description: "Array of multiple choice questions",
              items: {
                type: "OBJECT",
                properties: {
                  text: { type: "STRING", description: "The question text" },
                  choices: {
                    type: "ARRAY",
                    description: "Exactly 4 distinct choices",
                    items: { type: "STRING" },
                  },
                  correctAnswer: { type: "STRING", description: "The correct answer which must be one of the choices" },
                  concept: { type: "STRING", description: "The concept tested" },
                  difficulty: { type: "STRING", description: "The difficulty level (easy, medium, or hard)" },
                },
                required: ["text", "choices", "correctAnswer", "concept", "difficulty"],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        console.warn(`[Gemini Assessment] Model ${model} returned ${response.status}. Trying next fallback...`);
        lastError = new Error(`Gemini request failed (${model}): ${response.status}`);
        continue;
      }

      const json = await response.json();
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw || typeof raw !== "string") {
        lastError = new Error(`Gemini (${model}) returned an empty response.`);
        continue;
      }

      let parsedJson: unknown;
      try {
        let clean = raw.trim();
        if (clean.startsWith("```")) {
          clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        }
        parsedJson = JSON.parse(clean);
      } catch {
        lastError = new Error(`Gemini (${model}) returned invalid JSON format.`);
        continue;
      }

      const list = Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray((parsedJson as any)?.questions)
        ? (parsedJson as any).questions
        : Array.isArray((parsedJson as any)?.mcqs)
        ? (parsedJson as any).mcqs
        : null;

      if (!list || list.length === 0) {
        lastError = new Error(`Gemini (${model}) response did not contain a question list.`);
        continue;
      }

      const normalized = list.map((item: any) => {
        if (!item || typeof item !== "object") return item;
        return {
          text: typeof item.text === "string" ? item.text : typeof item.question === "string" ? item.question : item.text,
          choices: Array.isArray(item.choices) ? item.choices : Array.isArray(item.options) ? item.options : item.choices,
          correctAnswer:
            typeof item.correctAnswer === "string"
              ? item.correctAnswer
              : typeof item.correct_answer === "string"
              ? item.correct_answer
              : typeof item.answer === "string"
              ? item.answer
              : item.correctAnswer,
          concept: typeof item.concept === "string" ? item.concept : typeof item.topic === "string" ? item.topic : item.concept,
          difficulty: typeof item.difficulty === "string" ? item.difficulty.toLowerCase() : item.difficulty,
        };
      });

      const parsed = generatedQuestionsSchema.safeParse(normalized);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => {
            const index = typeof issue.path[0] === "number" ? issue.path[0] + 1 : String(issue.path[0] ?? "");
            const field = issue.path.slice(1).map((p) => String(p)).join(".") || "item";
            return `Question ${index}: ${issue.message} at ${field}`;
          })
          .join("; ");
        lastError = new Error(`Invalid question format from AI (${model}): ${issues}`);
        continue;
      }

      return parsed.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini Assessment] Error with ${model}: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("All Gemini models failed to generate questions.");
}