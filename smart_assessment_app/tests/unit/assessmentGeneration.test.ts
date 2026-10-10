import { describe, expect, it, vi } from "vitest";
import { generateAssessmentQuestions } from "@/lib/gemini/assessment";

describe("generateAssessmentQuestions prompt building", () => {
  it("generates assessment questions without additional instructions when omitted or empty", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    let capturedPrompt = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const body = JSON.parse(init.body as string);
        capturedPrompt = body?.contents?.[0]?.parts?.[0]?.text || "";
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        text: "What is glucose?",
                        choices: ["A simple sugar", "A protein", "A lipid", "A mineral"],
                        correctAnswer: "A simple sugar",
                        concept: "Glucose",
                        difficulty: "medium",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    try {
      const questions = await generateAssessmentQuestions({
        topic: "Cellular Energy",
        difficulty: "medium",
        count: 1,
        material: "Photosynthesis produces glucose which cells use for energy.",
      });

      expect(questions).toHaveLength(1);
      expect(capturedPrompt).toContain("Generate 1 MCQs from the material only.");
      expect(capturedPrompt).toContain("Mix theory and scenario/application questions");
      expect(capturedPrompt).not.toContain("Additional Instructions:");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("includes Additional Instructions in the prompt when instructions are provided", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    let capturedPrompt = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const body = JSON.parse(init.body as string);
        capturedPrompt = body?.contents?.[0]?.parts?.[0]?.text || "";
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        text: "Which enzyme is responsible for carbon fixation?",
                        choices: ["RuBisCO", "ATP synthase", "Amylase", "Pepsin"],
                        correctAnswer: "RuBisCO",
                        concept: "Calvin Cycle",
                        difficulty: "hard",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    try {
      const questions = await generateAssessmentQuestions({
        topic: "Plant Biology",
        difficulty: "hard",
        count: 5,
        material: "The Calvin cycle takes place in the stroma of chloroplasts.",
        instructions: "Emphasize enzyme names and biochemical reaction steps.",
      });

      expect(questions).toHaveLength(1);
      expect(capturedPrompt).toContain("Generate 5 MCQs from the material only.");
      expect(capturedPrompt).toContain(
        "Additional Instructions:\nEmphasize enzyme names and biochemical reaction steps."
      );
      expect(capturedPrompt).toContain("Match difficulty: hard.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes alternate keys (question, options, answer) and passes validation", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        question: "What is photosynthesis?",
                        options: ["Process to make glucose", "Process to digest food", "Cellular breakdown", "Transpiration"],
                        answer: "Process to make glucose",
                        concept: "Photosynthesis",
                        difficulty: "EASY",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    try {
      const questions = await generateAssessmentQuestions({
        topic: "Biology",
        difficulty: "easy",
        count: 1,
        material: "Photosynthesis makes glucose.",
      });

      expect(questions).toHaveLength(1);
      expect(questions[0].text).toBe("What is photosynthesis?");
      expect(questions[0].choices).toHaveLength(4);
      expect(questions[0].correctAnswer).toBe("Process to make glucose");
      expect(questions[0].concept).toBe("Photosynthesis");
      expect(questions[0].difficulty).toBe("easy");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles markdown codeblocks and nested object array structures", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```json\n" + JSON.stringify({
                      questions: [
                        {
                          text: "Which molecule stores genetic information?",
                          choices: ["DNA", "ATP", "Glucose", "Lipid"],
                          correctAnswer: "DNA",
                          concept: "Genetics",
                          difficulty: "medium",
                        },
                      ],
                    }) + "\n```",
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    try {
      const questions = await generateAssessmentQuestions({
        topic: "Genetics",
        difficulty: "medium",
        count: 1,
        material: "DNA carries genetic instructions.",
      });

      expect(questions).toHaveLength(1);
      expect(questions[0].text).toBe("Which molecule stores genetic information?");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gracefully falls back to secondary models when the first model returns an error or invalid questions", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        text: "Fallback question?",
                        choices: ["A", "B", "C", "D"],
                        correctAnswer: "A",
                        concept: "Fallback",
                        difficulty: "hard",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    });

    try {
      const questions = await generateAssessmentQuestions({
        topic: "Fallback Topic",
        difficulty: "hard",
        count: 1,
        material: "Some material content",
      });

      expect(callCount).toBe(2);
      expect(questions).toHaveLength(1);
      expect(questions[0].text).toBe("Fallback question?");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

