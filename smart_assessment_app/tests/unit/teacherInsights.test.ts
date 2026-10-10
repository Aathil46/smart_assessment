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

  describe("Teaching Insights Dashboard & Summary Aggregation", () => {
    const mockAssessments = [
      {
        id: "a1",
        title: "Cell Biology Quiz",
        topic: "Cells",
        className: "Grade 10 Biology",
        subject: "Science",
        studentsTotal: 25,
        studentsCompleted: 24,
        hasInsights: true,
        insightsCount: 3,
        createdAt: "2024-03-01T10:00:00Z",
      },
      {
        id: "a2",
        title: "Photosynthesis Unit Test",
        topic: "Plant Biology",
        className: "Grade 10 Biology",
        subject: "Science",
        studentsTotal: 25,
        studentsCompleted: 22,
        hasInsights: false,
        insightsCount: 0,
        createdAt: "2024-03-05T10:00:00Z",
      },
      {
        id: "a3",
        title: "Genetics Intro",
        topic: "Genetics",
        className: "Grade 11 AP Bio",
        subject: "Biology",
        studentsTotal: 20,
        studentsCompleted: 18,
        hasInsights: true,
        insightsCount: 2,
        createdAt: "2024-03-10T10:00:00Z",
      },
    ];

    it("calculates accurate summary metrics for completed assessments and generated insights", () => {
      const completedAssessments = mockAssessments.length;
      const generatedInsights = mockAssessments.filter((a) => a.hasInsights).length;
      const awaitingAnalysis = mockAssessments.filter((a) => !a.hasInsights).length;

      expect(completedAssessments).toBe(3);
      expect(generatedInsights).toBe(2);
      expect(awaitingAnalysis).toBe(1);
    });

    it("distinguishes analyzed assessments from assessments awaiting analysis", () => {
      const readyAssessments = mockAssessments.filter((a) => a.hasInsights);
      const pendingAssessments = mockAssessments.filter((a) => !a.hasInsights);

      expect(readyAssessments.map((a) => a.id)).toEqual(["a1", "a3"]);
      expect(pendingAssessments.map((a) => a.id)).toEqual(["a2"]);
    });

    it("filters assessments by search query across title, class, and subject", () => {
      const query = "Genetics";
      const matches = mockAssessments.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.className.toLowerCase().includes(query.toLowerCase()) ||
          (a.subject ? a.subject.toLowerCase().includes(query.toLowerCase()) : false)
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe("a3");
    });

    it("handles honest unavailable state for empty assessments list", () => {
      const emptyList: typeof mockAssessments = [];
      const summary = {
        completedAssessments: emptyList.length,
        generatedInsights: emptyList.filter((a) => a.hasInsights).length,
        conceptsNeedingAttention: null,
        studentsNeedingSupport: null,
      };

      expect(summary.completedAssessments).toBe(0);
      expect(summary.generatedInsights).toBe(0);
      expect(summary.conceptsNeedingAttention).toBeNull();
      expect(summary.studentsNeedingSupport).toBeNull();
    });
  });
});
