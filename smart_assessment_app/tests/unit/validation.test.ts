import { describe, expect, it } from "vitest";

import { aiMaterialSummarySchema, assessmentSchema, classSchema, questionSchema } from "@/lib/validation";

describe("classSchema", () => {
  it("accepts a valid class payload", () => {
    expect(
      classSchema.parse({
        name: "Algebra I",
        subject: "Math",
        grade: "9",
      }),
    ).toMatchObject({
      name: "Algebra I",
      subject: "Math",
      grade: "9",
    });
  });

  it("rejects empty class names", () => {
    expect(() => classSchema.parse({ name: "", subject: "Math", grade: "9" })).toThrow();
  });
});

describe("aiMaterialSummarySchema", () => {
  it("accepts valid AI summary output", () => {
    const valid = {
      title: "Quadratics",
      topic: "Quadratic equations",
      summary: "Students solve equations using factoring.",
      concepts: [
        { name: "Factorization", accuracy: 0.4 },
        { name: "Quadratics", accuracy: 0.35 },
      ],
    };

    expect(aiMaterialSummarySchema.parse(valid)).toEqual(valid);
  });

  it("rejects malformed concept payloads", () => {
    expect(() =>
      aiMaterialSummarySchema.parse({
        title: "Quadratics",
        topic: "Quadratic equations",
        summary: "Students solve equations using factoring.",
        concepts: [{ name: "Factorization", accuracy: 1.8 }],
      }),
    ).toThrow();
  });
});

describe("assessment and question validation", () => {
  it("accepts the supported assessment range and valid questions", () => {
    expect(assessmentSchema.parse({
      classId: "00000000-0000-4000-8000-000000000001",
      materialId: "00000000-0000-4000-8000-000000000002",
      title: "Quadratics",
      topic: "Equations",
      numQuestions: 10,
      difficulty: "medium",
    }).numQuestions).toBe(10);
    expect(questionSchema.parse({
      assessmentId: "00000000-0000-4000-8000-000000000001",
      text: "Which is correct?",
      choices: ["a", "b", "c", "d"],
      correctAnswer: "b",
      concept: "Factoring",
      difficulty: "easy",
    }).correctAnswer).toBe("b");
  });

  it("rejects invalid question choices and question counts", () => {
    expect(() => assessmentSchema.parse({ classId: "x", materialId: "y", title: "x", topic: "x", numQuestions: 2, difficulty: "easy" })).toThrow();
    expect(() => questionSchema.parse({ assessmentId: "00000000-0000-4000-8000-000000000001", text: "x", choices: ["a", "a", "c", "d"], correctAnswer: "b", concept: "x", difficulty: "easy" })).toThrow();
  });
});
