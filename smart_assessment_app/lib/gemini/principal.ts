export async function generatePrincipalReview(input: {
  passed: number;
  failed: number;
  weakConcepts: string[];
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "You are an educational AI assistant writing a short performance summary for a school Principal.",
    "",
    "The backend has already processed the student scores and identified weak concepts.",
    "Do not recalculate scores, determine Pass/Fail, or classify concepts.",
    "The supplied numbers are authoritative.",
    "",
    `Students Passed: ${input.passed}`,
    `Students Failed: ${input.failed}`,
    `Weak Concepts to Reteach: ${input.weakConcepts.length > 0 ? input.weakConcepts.join(", ") : "None"}`,
    "",
    "Write a concise, 1-3 sentence summary of these results.",
    "For example: 'In this test, X students passed and Y students failed. The weak concepts that need to be re-taught are Z.'",
    "Return plain text only — no markdown, no headers, no bullet points.",
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
