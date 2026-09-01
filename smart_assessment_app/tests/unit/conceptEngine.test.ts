import { describe, expect, it } from "vitest";
import {
  classifyConceptLevel,
  determinePassFail,
  isWeakStudent,
  detectLearningGaps,
  aggregateConceptPerformance,
  evaluateAttempt,
} from "@/lib/conceptEngine";

describe("V3 Phase 4 Concept Engine", () => {
  describe("Threshold & Classification Rules (Locked V3)", () => {
    it("classifies >= 80% as Strong", () => {
      expect(classifyConceptLevel(0.8)).toBe("Strong");
      expect(classifyConceptLevel(0.80001)).toBe("Strong");
      expect(classifyConceptLevel(0.95)).toBe("Strong");
      expect(classifyConceptLevel(1.0)).toBe("Strong");
      expect(classifyConceptLevel(8 / 10)).toBe("Strong");
    });

    it("classifies >= 50% and < 80% as Medium", () => {
      expect(classifyConceptLevel(0.5)).toBe("Medium");
      expect(classifyConceptLevel(0.5001)).toBe("Medium");
      expect(classifyConceptLevel(0.7)).toBe("Medium");
      expect(classifyConceptLevel(0.7999)).toBe("Medium");
      expect(classifyConceptLevel(5 / 10)).toBe("Medium");
      expect(classifyConceptLevel(7 / 10)).toBe("Medium");
      expect(classifyConceptLevel(2 / 3)).toBe("Medium");
    });

    it("classifies < 50% as Weak", () => {
      expect(classifyConceptLevel(0.0)).toBe("Weak");
      expect(classifyConceptLevel(0.2)).toBe("Weak");
      expect(classifyConceptLevel(0.4999)).toBe("Weak");
      expect(classifyConceptLevel(4 / 10)).toBe("Weak");
      expect(classifyConceptLevel(1 / 3)).toBe("Weak");
      expect(classifyConceptLevel(0 / 1)).toBe("Weak");
    });

    it("handles strict boundary tests correctly without premature rounding", () => {
      expect(classifyConceptLevel(0.4999)).toBe("Weak");
      expect(classifyConceptLevel(0.5)).toBe("Medium");
      expect(classifyConceptLevel(0.7999)).toBe("Medium");
      expect(classifyConceptLevel(0.8)).toBe("Strong");
    });
  });

  describe("Pass / Fail Rules (Locked V3)", () => {
    it("returns Pass for score > 50%", () => {
      expect(determinePassFail(6, 10)).toBe("Pass");
      expect(determinePassFail(10, 10)).toBe("Pass");
      expect(determinePassFail(3, 5)).toBe("Pass");
      expect(determinePassFail(51, 100)).toBe("Pass");
    });

    it("returns Fail for score <= 50%", () => {
      expect(determinePassFail(5, 10)).toBe("Fail");
      expect(determinePassFail(4, 10)).toBe("Fail");
      expect(determinePassFail(0, 10)).toBe("Fail");
      expect(determinePassFail(0, 0)).toBe("Fail");
      expect(determinePassFail(50, 100)).toBe("Fail");
    });
  });

  describe("Weak Student Derivation (Locked V3)", () => {
    it("marks student as Weak if they have at least one Weak concept, even with a high overall score", () => {
      const conceptPerformance = [
        {
          concept: "Chlorophyll",
          correctCount: 2,
          totalCount: 2,
          accuracy: 1.0,
          accuracyPercentage: 100,
          level: "Strong" as const,
        },
        {
          concept: "Light reactions",
          correctCount: 1,
          totalCount: 3,
          accuracy: 1 / 3,
          accuracyPercentage: 33.33,
          level: "Weak" as const,
        },
        {
          concept: "Stomata",
          correctCount: 2,
          totalCount: 2,
          accuracy: 1.0,
          accuracyPercentage: 100,
          level: "Strong" as const,
        },
      ];

      expect(isWeakStudent(conceptPerformance)).toBe(true);
    });

    it("does NOT mark student as Weak if all concepts are Strong or Medium", () => {
      const conceptPerformance = [
        {
          concept: "Chlorophyll",
          correctCount: 2,
          totalCount: 2,
          accuracy: 1.0,
          accuracyPercentage: 100,
          level: "Strong" as const,
        },
        {
          concept: "Calvin cycle",
          correctCount: 2,
          totalCount: 3,
          accuracy: 2 / 3,
          accuracyPercentage: 66.67,
          level: "Medium" as const,
        },
        {
          concept: "Stomata",
          correctCount: 2,
          totalCount: 2,
          accuracy: 1.0,
          accuracyPercentage: 100,
          level: "Strong" as const,
        },
      ];

      expect(isWeakStudent(conceptPerformance)).toBe(false);
    });
  });

  describe("Learning Gap Detection (Locked V3)", () => {
    it("generates learning gaps ONLY for Weak concepts, excluding Strong and Medium", () => {
      const conceptPerformance = [
        {
          concept: "Chlorophyll",
          correctCount: 2,
          totalCount: 2,
          accuracy: 1.0,
          accuracyPercentage: 100,
          level: "Strong" as const,
        },
        {
          concept: "Light reactions",
          correctCount: 1,
          totalCount: 3,
          accuracy: 1 / 3,
          accuracyPercentage: 33.33,
          level: "Weak" as const,
        },
        {
          concept: "Calvin cycle",
          correctCount: 2,
          totalCount: 3,
          accuracy: 2 / 3,
          accuracyPercentage: 66.67,
          level: "Medium" as const,
        },
        {
          concept: "Glucose",
          correctCount: 0,
          totalCount: 2,
          accuracy: 0.0,
          accuracyPercentage: 0,
          level: "Weak" as const,
        },
      ];

      const gaps = detectLearningGaps(conceptPerformance);

      expect(gaps).toHaveLength(2);
      expect(gaps.map((g) => g.concept)).toEqual(["Light reactions", "Glucose"]);
      expect(gaps.every((g) => g.level === "Weak")).toBe(true);
    });
  });

  describe("End-to-End Attempt Evaluation", () => {
    const sampleQuestions = [
      { id: "q1", correct_answer: "B", concept: "Chlorophyll" },
      { id: "q2", correct_answer: "A", concept: "Chlorophyll" },
      { id: "q3", correct_answer: "C", concept: "Light reactions" },
      { id: "q4", correct_answer: "D", concept: "Light reactions" },
      { id: "q5", correct_answer: "A", concept: "Light reactions" },
      { id: "q6", correct_answer: "B", concept: "Calvin cycle" },
      { id: "q7", correct_answer: "C", concept: "Calvin cycle" },
      { id: "q8", correct_answer: "D", concept: "Calvin cycle" },
      { id: "q9", correct_answer: "A", concept: "Stomata" },
      { id: "q10", correct_answer: "B", concept: "Stomata" },
    ];

    it("evaluates a student attempt accurately (Example from V3 Specification)", () => {
      // Student answers:
      // Chlorophyll: 2/2 correct
      // Light reactions: 1/3 correct (q3 correct, q4 wrong, q5 wrong)
      // Calvin cycle: 2/3 correct (q6 correct, q7 correct, q8 wrong)
      // Stomata: 2/2 correct
      // Total: 7/10 = 70% (Pass), but Weak Student because Light reactions = 33% (Weak)
      const studentAnswers = [
        { question_id: "q1", selected_choice: "B" }, // correct
        { question_id: "q2", selected_choice: "A" }, // correct
        { question_id: "q3", selected_choice: "C" }, // correct
        { question_id: "q4", selected_choice: "B" }, // incorrect
        { question_id: "q5", selected_choice: "C" }, // incorrect
        { question_id: "q6", selected_choice: "B" }, // correct
        { question_id: "q7", selected_choice: "C" }, // correct
        { question_id: "q8", selected_choice: "A" }, // incorrect
        { question_id: "q9", selected_choice: "A" }, // correct
        { question_id: "q10", selected_choice: "B" }, // correct
      ];

      const result = evaluateAttempt(sampleQuestions, studentAnswers);

      expect(result.score).toBe(7);
      expect(result.total).toBe(10);
      expect(result.percentage).toBe(70);
      expect(result.passFail).toBe("Pass");
      expect(result.isWeakStudent).toBe(true);

      const chlorophyll = result.conceptPerformance.find((c) => c.concept === "Chlorophyll");
      expect(chlorophyll).toEqual({
        concept: "Chlorophyll",
        correctCount: 2,
        totalCount: 2,
        accuracy: 1.0,
        accuracyPercentage: 100,
        level: "Strong",
      });

      const lightReactions = result.conceptPerformance.find((c) => c.concept === "Light reactions");
      expect(lightReactions?.correctCount).toBe(1);
      expect(lightReactions?.totalCount).toBe(3);
      expect(lightReactions?.level).toBe("Weak");

      const calvinCycle = result.conceptPerformance.find((c) => c.concept === "Calvin cycle");
      expect(calvinCycle?.correctCount).toBe(2);
      expect(calvinCycle?.totalCount).toBe(3);
      expect(calvinCycle?.level).toBe("Medium");

      const stomata = result.conceptPerformance.find((c) => c.concept === "Stomata");
      expect(stomata?.correctCount).toBe(2);
      expect(stomata?.totalCount).toBe(2);
      expect(stomata?.level).toBe("Strong");

      // Learning gaps must only contain Light reactions
      expect(result.learningGaps).toHaveLength(1);
      expect(result.learningGaps[0].concept).toBe("Light reactions");
      expect(result.learningGaps[0].level).toBe("Weak");
    });

    it("is idempotent: running multiple times produces identical results", () => {
      const studentAnswers = [
        { question_id: "q1", selected_choice: "B" },
        { question_id: "q2", selected_choice: "A" },
      ];

      const run1 = evaluateAttempt(sampleQuestions, studentAnswers);
      const run2 = evaluateAttempt(sampleQuestions, studentAnswers);

      expect(run1).toEqual(run2);
    });

    it("handles single-question concepts and edge-case accuracy", () => {
      const questions = [
        { id: "1", correct_answer: "A", concept: "ConceptOne" },
        { id: "2", correct_answer: "B", concept: "ConceptTwo" },
      ];
      const answers = [{ question_id: "1", selected_choice: "A" }]; // 1/1 for ConceptOne, 0/1 for ConceptTwo

      const result = evaluateAttempt(questions, answers);

      expect(result.conceptPerformance.find((c) => c.concept === "ConceptOne")?.level).toBe("Strong");
      expect(result.conceptPerformance.find((c) => c.concept === "ConceptTwo")?.level).toBe("Weak");
      expect(result.isWeakStudent).toBe(true);
      expect(result.learningGaps.map((g) => g.concept)).toEqual(["ConceptTwo"]);
    });
  });
});
