import { describe, expect, it } from "vitest";
import { classifyConceptLevel } from "@/lib/conceptEngine";

describe("Teacher AI Insights Generation Logic", () => {
  it("classifies weak concepts as high priority concept-gaps", () => {
    const concept = "Vertex Form";
    const correct = 3;
    const total = 10;
    const ratio = correct / total; // 0.30 -> Weak
    const level = classifyConceptLevel(ratio);

    expect(level).toBe("Weak");

    const insight = {
      type: "concept-gap" as const,
      priority: "high" as const,
      title: `${concept} needs reinforcement`,
      description: `${Math.round((1 - ratio) * 100)}% error rate on ${concept}.`,
    };

    expect(insight.priority).toBe("high");
    expect(insight.type).toBe("concept-gap");
    expect(insight.description).toContain("70% error rate");
  });

  it("classifies strong concepts as low priority positive notes", () => {
    const concept = "Quadratic Formula";
    const correct = 9;
    const total = 10;
    const ratio = correct / total; // 0.90 -> Strong
    const level = classifyConceptLevel(ratio);

    expect(level).toBe("Strong");

    const insight = {
      type: "positive" as const,
      priority: "low" as const,
      title: `${concept} mastery is strong`,
      description: `${Math.round(ratio * 100)}% of questions answered correctly.`,
    };

    expect(insight.priority).toBe("low");
    expect(insight.type).toBe("positive");
    expect(insight.description).toContain("90% of questions");
  });

  it("classifies medium concepts as medium priority teaching strategies", () => {
    const concept = "Factoring";
    const correct = 6;
    const total = 10;
    const ratio = correct / total; // 0.60 -> Medium
    const level = classifyConceptLevel(ratio);

    expect(level).toBe("Medium");

    const insight = {
      type: "teaching-strategy" as const,
      priority: "medium" as const,
      title: `${concept} understanding is developing`,
      description: `Students achieved an average accuracy of ${Math.round(ratio * 100)}%.`,
    };

    expect(insight.priority).toBe("medium");
    expect(insight.type).toBe("teaching-strategy");
  });

  it("identifies students needing support based on failing or low scores", () => {
    const students = [
      { id: "s1", name: "Alice", score: 4, total: 10 }, // 40% -> struggling
      { id: "s2", name: "Bob", score: 9, total: 10 },   // 90% -> passing
      { id: "s3", name: "Charlie", score: 3, total: 10 }, // 30% -> struggling
    ];

    const struggling = students.filter((s) => (s.score / s.total) < 0.5);
    expect(struggling.length).toBe(2);
    expect(struggling.map((s) => s.name)).toEqual(["Alice", "Charlie"]);

    const insight = {
      type: "student-support" as const,
      priority: "high" as const,
      title: `${struggling.length} students may need additional support`,
      affectedStudents: struggling.map((s) => s.name),
    };

    expect(insight.priority).toBe("high");
    expect(insight.affectedStudents).toEqual(["Alice", "Charlie"]);
  });
});
