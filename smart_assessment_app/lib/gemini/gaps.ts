/**
 * Generates a concise, student-friendly explanation for an already-detected learning gap.
 *
 * Privacy: Only anonymized concept data is sent to Gemini.
 * No student name, email, ID, or other PII is included.
 *
 * Reliability: Returns null on any failure — the deterministic result
 * remains authoritative regardless of Gemini availability.
 */
export async function explainGap(input: {
  concept: string;
  mastery: number;
  level: string;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "You are an educational assistant helping a student understand a weak area.",
    "",
    "The backend has already determined that this concept is weak based on the student's assessment performance.",
    "Do not recalculate scores, challenge the classification, or determine mastery level.",
    "The supplied accuracy and level are authoritative.",
    "",
    `Concept: ${input.concept}`,
    `Accuracy: ${input.mastery}%`,
    `Level: ${input.level}`,
    "",
    "Provide a concise, supportive explanation of what this concept covers and suggest",
    "what the student should review to improve their understanding.",
    "Keep the response to 2-3 sentences. Use plain, student-friendly language.",
    "Do not invent details about the student's identity or learning behavior.",
    "Return plain text only — no markdown, no bullet points, no headers.",
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    // Gemini failure must never break the deterministic result
    return null;
  }
}