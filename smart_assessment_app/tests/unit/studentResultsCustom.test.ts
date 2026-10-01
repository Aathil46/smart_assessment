import { describe, expect, it } from "vitest";
import { classifyConceptLevel, determinePassFail } from "@/lib/conceptEngine";

describe("Student Results Custom Workflow", () => {
  it("computes enrolled class metrics for student results accurately", () => {
    const classMemberships = [
      { class_id: "cls-1" },
      { class_id: "cls-2" },
    ];

    const assessments = [
      { id: "a1", class_id: "cls-1" },
      { id: "a2", class_id: "cls-1" },
      { id: "a3", class_id: "cls-2" },
    ];

    const studentAttempts = [
      { assessment_id: "a1", score: 9, total: 10, submitted_at: "2026-09-01T12:00:00Z" },
      { assessment_id: "a2", score: 7, total: 10, submitted_at: "2026-09-02T12:00:00Z" },
    ];

    const cls1Assessments = assessments.filter((a) => a.class_id === "cls-1");
    const cls1AssIds = new Set(cls1Assessments.map((a) => a.id));
    const cls1Attempts = studentAttempts.filter(
      (at) => cls1AssIds.has(at.assessment_id) && at.submitted_at !== null
    );

    const totalScorePct = cls1Attempts.reduce(
      (sum, at) => sum + (at.score / at.total) * 100,
      0
    );
    const avgScore = Math.round(totalScorePct / cls1Attempts.length);

    expect(cls1Assessments.length).toBe(2);
    expect(cls1Attempts.length).toBe(2);
    expect(avgScore).toBe(80); // (90 + 70) / 2 = 80
  });

  it("categorizes concepts into Strong, Medium, and Weak groups for Concept Analysis", () => {
    const rawConcepts = [
      { concept: "Linear Equations", accuracy: 0.9 },
      { concept: "Polynomials", accuracy: 0.8 },
      { concept: "Quadratics", accuracy: 0.65 },
      { concept: "Functions", accuracy: 0.5 },
      { concept: "Trigonometry", accuracy: 0.35 },
    ];

    const mapped = rawConcepts.map((c) => {
      const level = classifyConceptLevel(c.accuracy);
      return {
        concept: c.concept,
        accuracyPercentage: Number((c.accuracy * 100).toFixed(1)),
        level,
      };
    });

    const strongConcepts = mapped.filter((c) => c.level === "Strong");
    const mediumConcepts = mapped.filter((c) => c.level === "Medium");
    const weakConcepts = mapped.filter((c) => c.level === "Weak");

    expect(strongConcepts.length).toBe(2);
    expect(strongConcepts.map((c) => c.concept)).toEqual(["Linear Equations", "Polynomials"]);
    expect(strongConcepts[0].accuracyPercentage).toBe(90);

    expect(mediumConcepts.length).toBe(2);
    expect(mediumConcepts.map((c) => c.concept)).toEqual(["Quadratics", "Functions"]);
    expect(mediumConcepts[0].accuracyPercentage).toBe(65);

    expect(weakConcepts.length).toBe(1);
    expect(weakConcepts[0].concept).toBe("Trigonometry");
    expect(weakConcepts[0].accuracyPercentage).toBe(35);
  });

  it("handles pass/fail determination and learning gaps correctly", () => {
    const passedAttempt = { score: 7, total: 10 };
    const failedAttempt = { score: 4, total: 10 };

    expect(determinePassFail(passedAttempt.score, passedAttempt.total)).toBe("Pass");
    expect(determinePassFail(failedAttempt.score, failedAttempt.total)).toBe("Fail");

    const gaps = [
      {
        concept: "Trigonometry",
        gap_level: "Weak",
        notes: "Student struggled with sine and cosine identities.",
        recommendations: ["Review unit circle definitions", "Practice basic right triangle problems"],
      },
    ];

    expect(gaps.length).toBe(1);
    expect(gaps[0].gap_level).toBe("Weak");
    expect(gaps[0].recommendations.length).toBe(2);
  });
});
