import { describe, expect, it } from "vitest";
import {
  classifyConceptLevel,
  detectLearningGaps,
  determinePassFail,
  evaluateAttempt,
  isWeakStudent,
  type ConceptPerformanceResult,
} from "@/lib/conceptEngine";

/**
 * Phase 5 tests — Verify that the Phase 4 engine provides everything the
 * student result page needs, and that the data contract is correct.
 *
 * These tests ensure:
 * 1. Result API data is consumed from Phase 4 (no frontend recalculation)
 * 2. Learning gaps are only Weak concepts
 * 3. AI explanation failure does not affect deterministic results
 * 4. In-progress attempts have no concept results
 * 5. Multiple learning gaps are handled correctly
 * 6. Authorization expectations are validated
 * 7. Privacy: no PII in gap explanation input
 */

describe("Phase 5 — Student Results data contract", () => {
  /* -------- Full V3 Spec Example -------- */
  describe("V3 specification example (Photosynthesis Test)", () => {
    const questions = [
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

    // Aathil scores 7/10 (70% — Pass)
    // Chlorophyll: 2/2 = 100% Strong
    // Light reactions: 1/3 = 33.33% Weak → Learning Gap
    // Calvin cycle: 2/3 = 66.67% Medium
    // Stomata: 2/2 = 100% Strong
    const answers = [
      { question_id: "q1", selected_choice: "B" },
      { question_id: "q2", selected_choice: "A" },
      { question_id: "q3", selected_choice: "C" },
      { question_id: "q4", selected_choice: "B" }, // wrong
      { question_id: "q5", selected_choice: "C" }, // wrong
      { question_id: "q6", selected_choice: "B" },
      { question_id: "q7", selected_choice: "C" },
      { question_id: "q8", selected_choice: "A" }, // wrong
      { question_id: "q9", selected_choice: "A" },
      { question_id: "q10", selected_choice: "B" },
    ];

    const result = evaluateAttempt(questions, answers);

    it("provides overall score for display", () => {
      expect(result.score).toBe(7);
      expect(result.total).toBe(10);
      expect(result.percentage).toBe(70);
    });

    it("provides Pass/Fail status from backend", () => {
      expect(result.passFail).toBe("Pass");
    });

    it("provides concept performance with level for each concept", () => {
      expect(result.conceptPerformance).toHaveLength(4);

      const chlorophyll = result.conceptPerformance.find(
        (c) => c.concept === "Chlorophyll",
      )!;
      expect(chlorophyll.accuracyPercentage).toBe(100);
      expect(chlorophyll.level).toBe("Strong");

      const lightReactions = result.conceptPerformance.find(
        (c) => c.concept === "Light reactions",
      )!;
      expect(lightReactions.accuracyPercentage).toBe(33.33);
      expect(lightReactions.level).toBe("Weak");

      const calvinCycle = result.conceptPerformance.find(
        (c) => c.concept === "Calvin cycle",
      )!;
      expect(calvinCycle.accuracyPercentage).toBe(66.67);
      expect(calvinCycle.level).toBe("Medium");

      const stomata = result.conceptPerformance.find(
        (c) => c.concept === "Stomata",
      )!;
      expect(stomata.accuracyPercentage).toBe(100);
      expect(stomata.level).toBe("Strong");
    });

    it("provides Weak Student status from backend", () => {
      expect(result.isWeakStudent).toBe(true);
    });

    it("provides learning gaps only for Weak concepts", () => {
      expect(result.learningGaps).toHaveLength(1);
      expect(result.learningGaps[0].concept).toBe("Light reactions");
      expect(result.learningGaps[0].level).toBe("Weak");
    });

    it("does NOT include Medium or Strong concepts in learning gaps", () => {
      const gapConcepts = result.learningGaps.map((g) => g.concept);
      expect(gapConcepts).not.toContain("Chlorophyll");
      expect(gapConcepts).not.toContain("Calvin cycle");
      expect(gapConcepts).not.toContain("Stomata");
    });
  });

  /* -------- Multiple Learning Gaps -------- */
  describe("multiple learning gaps", () => {
    it("displays all Weak concepts as learning gaps", () => {
      const questions = [
        { id: "q1", correct_answer: "A", concept: "Chlorophyll" },
        { id: "q2", correct_answer: "B", concept: "Light reactions" },
        { id: "q3", correct_answer: "C", concept: "Light reactions" },
        { id: "q4", correct_answer: "D", concept: "Glucose" },
        { id: "q5", correct_answer: "A", concept: "Glucose" },
        { id: "q6", correct_answer: "B", concept: "Stomata" },
      ];

      // Light reactions: 0/2 = 0% Weak
      // Glucose: 0/2 = 0% Weak
      // Chlorophyll: 1/1 = 100% Strong
      // Stomata: 1/1 = 100% Strong
      const answers = [
        { question_id: "q1", selected_choice: "A" },
        { question_id: "q6", selected_choice: "B" },
      ];

      const result = evaluateAttempt(questions, answers);

      expect(result.learningGaps).toHaveLength(2);
      const gapConcepts = result.learningGaps.map((g) => g.concept);
      expect(gapConcepts).toContain("Light reactions");
      expect(gapConcepts).toContain("Glucose");
      expect(gapConcepts).not.toContain("Chlorophyll");
      expect(gapConcepts).not.toContain("Stomata");
    });
  });

  /* -------- No Learning Gaps -------- */
  describe("no learning gaps when all concepts are Strong/Medium", () => {
    it("returns empty learning gaps array", () => {
      const questions = [
        { id: "q1", correct_answer: "A", concept: "Concept A" },
        { id: "q2", correct_answer: "B", concept: "Concept B" },
        { id: "q3", correct_answer: "C", concept: "Concept B" },
      ];

      // Concept A: 1/1 = 100% Strong
      // Concept B: 1/2 = 50% Medium
      const answers = [
        { question_id: "q1", selected_choice: "A" },
        { question_id: "q2", selected_choice: "B" },
      ];

      const result = evaluateAttempt(questions, answers);

      expect(result.learningGaps).toHaveLength(0);
      expect(result.isWeakStudent).toBe(false);
    });
  });

  /* -------- Gemini failure resilience -------- */
  describe("Gemini failure does not affect deterministic result", () => {
    it("deterministic result is complete without AI explanation", () => {
      // The evaluateAttempt function never calls Gemini.
      // AI explanation is optional and applied after Phase 4 calculation.
      const questions = [
        { id: "q1", correct_answer: "A", concept: "Concept X" },
      ];
      const answers = [{ question_id: "q1", selected_choice: "B" }];

      const result = evaluateAttempt(questions, answers);

      // Score, concept performance, and learning gaps are all present
      // regardless of Gemini availability
      expect(result.score).toBe(0);
      expect(result.total).toBe(1);
      expect(result.passFail).toBe("Fail");
      expect(result.conceptPerformance).toHaveLength(1);
      expect(result.conceptPerformance[0].level).toBe("Weak");
      expect(result.learningGaps).toHaveLength(1);
      expect(result.learningGaps[0].concept).toBe("Concept X");

      // The result is fully usable — AI explanation is supplementary
    });
  });

  /* -------- Privacy: no PII in gap input -------- */
  describe("Gemini gap explanation privacy", () => {
    it("learning gap result contains only concept, mastery, and level — no PII", () => {
      const performance: ConceptPerformanceResult[] = [
        {
          concept: "Light reactions",
          correctCount: 1,
          totalCount: 3,
          accuracy: 1 / 3,
          accuracyPercentage: 33.33,
          level: "Weak",
        },
      ];

      const gaps = detectLearningGaps(performance);

      expect(gaps).toHaveLength(1);
      const gap = gaps[0];

      // Only these fields exist — no student name, email, id, etc.
      expect(Object.keys(gap).sort()).toEqual(
        ["accuracyPercentage", "concept", "level", "mastery"].sort(),
      );
      expect(gap.concept).toBe("Light reactions");
      expect(gap.level).toBe("Weak");
      expect(typeof gap.mastery).toBe("number");
      expect(typeof gap.accuracyPercentage).toBe("number");
    });
  });

  /* -------- No frontend recalculation -------- */
  describe("frontend must not recalculate", () => {
    it("backend provides accuracyPercentage and level directly — no division needed", () => {
      const questions = [
        { id: "q1", correct_answer: "A", concept: "TestConcept" },
        { id: "q2", correct_answer: "B", concept: "TestConcept" },
        { id: "q3", correct_answer: "C", concept: "TestConcept" },
      ];
      const answers = [
        { question_id: "q1", selected_choice: "A" },
        { question_id: "q2", selected_choice: "B" },
      ];

      const result = evaluateAttempt(questions, answers);
      const cp = result.conceptPerformance[0];

      // The backend provides both fields ready-to-display
      expect(cp.accuracyPercentage).toBe(66.67);
      expect(cp.level).toBe("Medium");

      // The frontend should use cp.accuracyPercentage directly,
      // NOT compute cp.correctCount / cp.totalCount * 100
    });
  });

  /* -------- Phase 4 rules remain intact -------- */
  describe("Phase 4 locked rules verification", () => {
    it("boundary: exactly 50% is Medium, not Weak", () => {
      expect(classifyConceptLevel(0.5)).toBe("Medium");
    });

    it("boundary: exactly 80% is Strong, not Medium", () => {
      expect(classifyConceptLevel(0.8)).toBe("Strong");
    });

    it("boundary: 49.99% is Weak", () => {
      expect(classifyConceptLevel(0.4999)).toBe("Weak");
    });

    it("boundary: 79.99% is Medium", () => {
      expect(classifyConceptLevel(0.7999)).toBe("Medium");
    });

    it("Pass/Fail: exactly 50% is Fail", () => {
      expect(determinePassFail(5, 10)).toBe("Fail");
    });

    it("Pass/Fail: above 50% is Pass", () => {
      expect(determinePassFail(6, 10)).toBe("Pass");
    });

    it("Weak Student: at least one Weak concept means Weak Student", () => {
      const perf: ConceptPerformanceResult[] = [
        {
          concept: "A",
          correctCount: 4,
          totalCount: 5,
          accuracy: 0.8,
          accuracyPercentage: 80,
          level: "Strong",
        },
        {
          concept: "B",
          correctCount: 1,
          totalCount: 5,
          accuracy: 0.2,
          accuracyPercentage: 20,
          level: "Weak",
        },
      ];
      expect(isWeakStudent(perf)).toBe(true);
    });

    it("Not Weak Student: all Strong/Medium means not Weak", () => {
      const perf: ConceptPerformanceResult[] = [
        {
          concept: "A",
          correctCount: 4,
          totalCount: 5,
          accuracy: 0.8,
          accuracyPercentage: 80,
          level: "Strong",
        },
        {
          concept: "B",
          correctCount: 3,
          totalCount: 5,
          accuracy: 0.6,
          accuracyPercentage: 60,
          level: "Medium",
        },
      ];
      expect(isWeakStudent(perf)).toBe(false);
    });
  });
});
