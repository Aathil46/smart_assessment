export type PrincipalReviewDiagnostics = {
  apiKeyConfigured: boolean;
  providerUrl: string;
  providerStatus: number | null;
  providerError: {
    message: string | null;
    status: number | null;
    body: string | null;
  } | null;
  parsedResponse: unknown;
  result: string | null;
};

export async function generatePrincipalReview(input: {
  passed: number;
  failed: number;
  weakConcepts: string[];
}, onDiagnostics?: (diagnostics: PrincipalReviewDiagnostics) => void): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const providerUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
  const diagnostics: PrincipalReviewDiagnostics = {
    apiKeyConfigured: Boolean(apiKey),
    providerUrl,
    providerStatus: null,
    providerError: null,
    parsedResponse: null,
    result: null,
  };

  if (!apiKey) {
    diagnostics.providerError = { message: "Gemini API key is not configured.", status: null, body: null };
    onDiagnostics?.(diagnostics);
    return null;
  }

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
      `${providerUrl}?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    diagnostics.providerStatus = response.status;
    const responseBody = await response.text();
    let data: any = null;
    try {
      data = responseBody ? JSON.parse(responseBody) : null;
    } catch {
      data = null;
    }
    diagnostics.parsedResponse = data;

    if (!response.ok) {
      diagnostics.providerError = {
        message: (data?.error?.message ?? response.statusText) || null,
        status: response.status,
        body: responseBody || null,
      };
      onDiagnostics?.(diagnostics);
      return null;
    }

    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    diagnostics.result = result;
    if (!result) {
      diagnostics.providerError = { message: "Gemini returned no review text.", status: response.status, body: responseBody || null };
    }
    onDiagnostics?.(diagnostics);
    return result;
  } catch (error) {
    // Gemini failure must never break the deterministic result
    diagnostics.providerError = {
      message: error instanceof Error ? error.message : "Gemini request failed.",
      status: diagnostics.providerStatus,
      body: null,
    };
    onDiagnostics?.(diagnostics);
    return null;
  }
}
