import { describe, expect, it } from "vitest";
import { deriveLearningGaps, scoreAttempt } from "@/lib/scoring";

describe("assessment scoring & V3 concept integration", () => {
  it("scores missing answers as incorrect and groups concept performance", () => {
    const result = scoreAttempt(
      [
        { id: "1", correct_answer: "a", concept: "Linear" },
        { id: "2", correct_answer: "b", concept: "Linear" },
        { id: "3", correct_answer: "c", concept: "Quadratic" },
      ],
      [{ question_id: "1", selected_choice: "a" }],
    );
    expect(result.score).toBe(1);
    expect(result.total).toBe(3);
    expect(result.passFail).toBe("Fail");
    expect(result.isWeakStudent).toBe(true);
    expect(result.conceptPerformance).toEqual([
      { concept: "Linear", correctCount: 1, totalCount: 2, accuracy: 0.5, level: "Medium" },
      { concept: "Quadratic", correctCount: 0, totalCount: 1, accuracy: 0, level: "Weak" },
    ]);
  });

  it("derives learning gaps ONLY for Weak concepts in V3", () => {
    const gaps = deriveLearningGaps([
      { concept: "A", correctCount: 0, totalCount: 2, accuracy: 0.49, level: "Weak" },
      { concept: "B", correctCount: 3, totalCount: 4, accuracy: 0.75, level: "Medium" },
      { concept: "C", correctCount: 4, totalCount: 5, accuracy: 0.8, level: "Strong" },
    ]);

    expect(gaps).toEqual([
      { concept: "A", mastery: 0.49, level: "Weak" },
    ]);
  });
});