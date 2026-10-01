import { describe, expect, it } from "vitest";
import { classifyConceptLevel, determinePassFail } from "@/lib/conceptEngine";

describe("Teacher Results & Analytics Integration", () => {
  it("correctly computes completed attempts, average score, and pass rate", () => {
    const attempts = [
      { score: 8, total: 10, submitted_at: "2026-09-01T10:00:00Z" },
      { score: 4, total: 10, submitted_at: "2026-09-01T10:05:00Z" },
      { score: null, total: null, submitted_at: null }, // in progress
    ];

    const submitted = attempts.filter((a) => a.submitted_at);
    expect(submitted.length).toBe(2);

    let passCount = 0;
    let totalPct = 0;

    for (const att of submitted) {
      const score = att.score ?? 0;
      const total = att.total && att.total > 0 ? att.total : 1;
      const pct = (score / total) * 100;
      totalPct += pct;
      if (determinePassFail(score, total) === "Pass") {
        passCount++;
      }
    }

    const avgScore = Math.round(totalPct / submitted.length);
    const passRate = Math.round((passCount / submitted.length) * 100);

    expect(avgScore).toBe(60); // (80 + 40) / 2 = 60
    expect(passRate).toBe(50); // 1 passed, 1 failed = 50%
  });

  it("correctly categorizes concepts into strong, medium, and weak", () => {
    const rawConcepts = [
      { concept: "Factoring", accuracy: 0.9 },
      { concept: "Quadratic Formula", accuracy: 0.65 },
      { concept: "Discriminant", accuracy: 0.3 },
    ];

    const mapped = rawConcepts.map((c) => {
      const level = classifyConceptLevel(c.accuracy);
      const mastery = level === "Strong" ? "strong" : level === "Medium" ? "medium" : "weak";
      return { concept: c.concept, score: Math.round(c.accuracy * 100), mastery };
    });

    const strong = mapped.filter((c) => c.mastery === "strong");
    const medium = mapped.filter((c) => c.mastery === "medium");
    const weak = mapped.filter((c) => c.mastery === "weak");

    expect(strong.length).toBe(1);
    expect(strong[0].concept).toBe("Factoring");
    expect(strong[0].score).toBe(90);

    expect(medium.length).toBe(1);
    expect(medium[0].concept).toBe("Quadratic Formula");
    expect(medium[0].score).toBe(65);

    expect(weak.length).toBe(1);
    expect(weak[0].concept).toBe("Discriminant");
    expect(weak[0].score).toBe(30);
  });
});
