/**
 * Generates AI-powered teaching insights for a completed assessment.
 *
 * Input: Aggregated concept weaknesses and affected student names (no PII beyond names).
 * Output: Structured array of insights sorted by priority.
 *
 * Reliability: Returns null on any Gemini failure — caller must handle gracefully.
 */

export interface AIInsightItem {
  concept: string;
  priority: "high" | "medium" | "low";
  weakStudentCount: number;
  action: string;
  focusStudents: string[]; // up to 5 first names
}

export interface AIInsightsResult {
  insights: AIInsightItem[];
  generatedAt: string;
}

interface ConceptWeakness {
  concept: string;
  accuracyPct: number; // 0-100
  weakStudentCount: number;
  totalStudentCount: number;
  studentNames: string[]; // student first names / display names
}

const FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

export async function generateTeacherInsights(input: {
  assessmentTitle: string;
  subject: string | null;
  weaknesses: ConceptWeakness[]; // weak concepts (accuracy < 50%)
  mediumWeaknesses: ConceptWeakness[]; // medium concepts (50–70%)
  apiKey?: string;
}): Promise<AIInsightsResult | null> {
  const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { assessmentTitle, subject, weaknesses, mediumWeaknesses } = input;

  // Build a concise data summary for the prompt
  const allWeaknesses = [
    ...weaknesses.map((w) => ({ ...w, bucket: "weak" as const })),
    ...mediumWeaknesses.map((w) => ({ ...w, bucket: "medium" as const })),
  ].sort((a, b) => b.weakStudentCount - a.weakStudentCount);

  if (allWeaknesses.length === 0) return null;

  // Keep prompt tight — only the data Gemini needs
  const conceptLines = allWeaknesses
    .slice(0, 10) // cap at 10 to keep tokens low
    .map((w, i) => {
      const names = w.studentNames.slice(0, 5).join(", ");
      return `${i + 1}. Concept: "${w.concept}" | Accuracy: ${w.accuracyPct}% | Weak students: ${w.weakStudentCount}/${w.totalStudentCount} | Students: ${names || "N/A"}`;
    })
    .join("\n");

  const prompt = `You are an educational AI assistant helping a teacher understand student weaknesses after an assessment.

Assessment: "${assessmentTitle}"${subject ? `\nSubject: ${subject}` : ""}

Below are concepts where students struggled, sorted by most-affected students:
${conceptLines}

Return a JSON array (no markdown, no explanation) with one object per concept. Each object must have EXACTLY these fields:
- "concept": string (exact concept name from above)
- "priority": "high" | "medium" | "low"  (high = many students weak, medium = some, low = few)
- "weakStudentCount": number (copy from data above)
- "action": string (1–2 sentence practical teaching action the teacher should take)
- "focusStudents": string[] (up to 3 student names from the data who need the most attention)

Rules:
- Do NOT invent concept names or student names. Use only the names provided above.
- Keep "action" short and specific. No generic advice.
- Priority: high if >40% of students weak, medium if 20-40%, low if <20%.
- Return only the JSON array, nothing else.

Example item:
{"concept":"Photosynthesis","priority":"high","weakStudentCount":8,"action":"Reteach photosynthesis with a diagram showing light and dark reactions.","focusStudents":["Bala","Ram","Priya"]}`;

  const primary = process.env.GEMINI_INSIGHTS_MODEL || "gemini-2.0-flash";
  const modelsToTry = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          console.warn(`[Gemini TeacherInsights] Model ${model} rate-limited. Trying next...`);
          lastError = new Error(`Rate limited (${model}): ${response.status}`);
          continue;
        }
        throw new Error(`Gemini request failed (${model}): ${response.status}`);
      }

      const json = await response.json();
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        lastError = new Error(`Gemini (${model}) returned no content.`);
        continue;
      }

      // Parse the JSON array
      let parsed: any[];
      try {
        parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Not an array");
      } catch {
        lastError = new Error(`Gemini (${model}) returned invalid JSON.`);
        continue;
      }

      // Validate and normalize each item
      const insights: AIInsightItem[] = parsed
        .filter(
          (item: any) =>
            item &&
            typeof item.concept === "string" &&
            typeof item.action === "string" &&
            ["high", "medium", "low"].includes(item.priority)
        )
        .map((item: any) => ({
          concept: String(item.concept),
          priority: item.priority as "high" | "medium" | "low",
          weakStudentCount: typeof item.weakStudentCount === "number" ? item.weakStudentCount : 0,
          action: String(item.action),
          focusStudents: Array.isArray(item.focusStudents)
            ? item.focusStudents.slice(0, 5).map(String)
            : [],
        }));

      if (insights.length === 0) {
        lastError = new Error("No valid insights after parsing.");
        continue;
      }

      return {
        insights,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini TeacherInsights] Error with ${model}: ${lastError.message}`);
    }
  }

  console.error("[Gemini TeacherInsights] All models failed:", lastError?.message);
  return null;
}
