export type ConceptLevel = "Strong" | "Medium" | "Weak";
export type PassFailStatus = "Pass" | "Fail";

export type ScoringQuestion = {
  id: string;
  correct_answer: string;
  concept: string;
};

export type ScoringAnswer = {
  question_id: string;
  selected_choice: string | null | undefined;
};

export type ConceptPerformanceResult = {
  concept: string;
  correctCount: number;
  totalCount: number;
  accuracy: number; // Exact ratio [0, 1]
  accuracyPercentage: number; // Accuracy formatted as percentage [0, 100]
  level: ConceptLevel;
};

export type LearningGapResult = {
  concept: string;
  mastery: number; // Exact ratio [0, 1]
  accuracyPercentage: number;
  level: "Weak";
};

export type EvaluatedAnswer = {
  questionId: string;
  concept: string;
  selectedChoice: string | null;
  correctAnswer: string;
  isCorrect: boolean;
};

export type AttemptEvaluationResult = {
  score: number;
  total: number;
  percentage: number;
  passFail: PassFailStatus;
  isWeakStudent: boolean;
  conceptPerformance: ConceptPerformanceResult[];
  learningGaps: LearningGapResult[];
  evaluatedAnswers: EvaluatedAnswer[];
};

/**
 * Classifies concept mastery level based on exact accuracy ratio.
 * Locked V3 Rules:
 * - Strong: accuracy >= 0.80 (>= 80%)
 * - Medium: 0.50 <= accuracy < 0.80 (50% to <80%)
 * - Weak:   accuracy < 0.50 (< 50%)
 *
 * NOTE: Operates on exact underlying ratio to prevent premature rounding errors.
 */
export function classifyConceptLevel(ratio: number): ConceptLevel {
  if (ratio >= 0.8) {
    return "Strong";
  }
  if (ratio >= 0.5) {
    return "Medium";
  }
  return "Weak";
}

/**
 * Determines Pass/Fail status for an overall score.
 * Locked V3 Rules:
 * - Pass: score > 50%
 * - Fail: score <= 50%
 */
export function determinePassFail(score: number, total: number): PassFailStatus {
  if (total <= 0) return "Fail";
  const ratio = score / total;
  return ratio > 0.5 ? "Pass" : "Fail";
}

/**
 * Determines if a student is considered Weak.
 * Locked V3 Rule:
 * - A student is Weak if they have at least ONE Weak concept (accuracy < 50%).
 */
export function isWeakStudent(conceptPerformance: ConceptPerformanceResult[]): boolean {
  return conceptPerformance.some((cp) => cp.level === "Weak");
}

/**
 * Filters and generates learning gaps strictly for Weak concepts.
 * Locked V3 Rule:
 * - Strong -> No gap
 * - Medium -> No gap
 * - Weak   -> Learning gap
 */
export function detectLearningGaps(conceptPerformance: ConceptPerformanceResult[]): LearningGapResult[] {
  return conceptPerformance
    .filter((cp) => cp.level === "Weak")
    .map((cp) => ({
      concept: cp.concept,
      mastery: cp.accuracy,
      accuracyPercentage: cp.accuracyPercentage,
      level: "Weak",
    }));
}

/**
 * Aggregates evaluated questions by concept and calculates exact performance.
 */
export function aggregateConceptPerformance(
  evaluatedAnswers: Array<{ concept: string; isCorrect: boolean }>,
): ConceptPerformanceResult[] {
  const conceptMap = new Map<string, { correctCount: number; totalCount: number }>();

  for (const item of evaluatedAnswers) {
    const concept = item.concept.trim();
    if (!concept) continue;

    const current = conceptMap.get(concept) ?? { correctCount: 0, totalCount: 0 };
    current.totalCount += 1;
    if (item.isCorrect) {
      current.correctCount += 1;
    }
    conceptMap.set(concept, current);
  }

  return Array.from(conceptMap.entries()).map(([concept, counts]) => {
    const accuracy = counts.totalCount > 0 ? counts.correctCount / counts.totalCount : 0;
    const accuracyPercentage = Number((accuracy * 100).toFixed(2));
    const level = classifyConceptLevel(accuracy);

    return {
      concept,
      correctCount: counts.correctCount,
      totalCount: counts.totalCount,
      accuracy,
      accuracyPercentage,
      level,
    };
  });
}

/**
 * Deterministically evaluates a complete assessment attempt.
 * Pure backend calculation — zero external AI dependency.
 */
export function evaluateAttempt(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
): AttemptEvaluationResult {
  const answerMap = new Map<string, string | null>(
    answers.map((a) => [a.question_id, a.selected_choice ?? null]),
  );

  let score = 0;
  const evaluatedAnswers: EvaluatedAnswer[] = [];

  for (const q of questions) {
    const selected = answerMap.get(q.id) ?? null;
    const isCorrect = selected !== null && selected === q.correct_answer;
    if (isCorrect) {
      score += 1;
    }

    evaluatedAnswers.push({
      questionId: q.id,
      concept: q.concept,
      selectedChoice: selected,
      correctAnswer: q.correct_answer,
      isCorrect,
    });
  }

  const total = questions.length;
  const percentage = total > 0 ? Number(((score / total) * 100).toFixed(2)) : 0;
  const passFail = determinePassFail(score, total);
  const conceptPerformance = aggregateConceptPerformance(
    evaluatedAnswers.map((ea) => ({ concept: ea.concept, isCorrect: ea.isCorrect })),
  );
  const learningGaps = detectLearningGaps(conceptPerformance);
  const weakStudent = isWeakStudent(conceptPerformance);

  return {
    score,
    total,
    percentage,
    passFail,
    isWeakStudent: weakStudent,
    conceptPerformance,
    learningGaps,
    evaluatedAnswers,
  };
}
