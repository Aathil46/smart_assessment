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
 * Determines if a student is classified as "Needs Support" based on their weak concept ratio.
 *
 * Formula:
 * weakConceptRatio = weakConceptCount / totalAssessedConceptCount
 * needsSupport = weakConceptRatio > 0.40
 *
 * Rules:
 * - weakConceptCount: number of distinct assessed concepts where the student is classified as Weak (accuracy < 0.50).
 * - totalAssessedConceptCount: number of distinct assessed concepts actually assessed for that student.
 * - Distinct concepts are counted only once per student (multiple questions mapped to the same concept
 *   do not inflate denominator or numerator).
 * - Strict greater-than comparison (> 0.40). Exactly 40% is NOT flagged.
 * - If totalAssessedConceptCount is 0, safely returns false (no division by zero).
 */
export function isWeakStudent(
  conceptPerformance: Array<{
    concept: string;
    level?: ConceptLevel | string;
    accuracy?: number;
    correctCount?: number;
    totalCount?: number;
    correct_count?: number;
    total_count?: number;
  }>,
): boolean {
  if (!conceptPerformance || !Array.isArray(conceptPerformance) || conceptPerformance.length === 0) {
    return false;
  }

  // Deduplicate distinct concepts by normalized name
  const conceptMap = new Map<
    string,
    {
      hasWeak: boolean;
      correctCount: number;
      totalCount: number;
      hasCounts: boolean;
      level?: string;
    }
  >();

  for (const cp of conceptPerformance) {
    if (!cp || typeof cp.concept !== "string") continue;
    const trimmed = cp.concept.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();

    const correct = cp.correctCount ?? cp.correct_count;
    const total = cp.totalCount ?? cp.total_count;
    const hasCounts = typeof correct === "number" && typeof total === "number" && total > 0;

    const existing = conceptMap.get(key);
    if (!existing) {
      conceptMap.set(key, {
        hasWeak: cp.level === "Weak" || (typeof cp.accuracy === "number" && cp.accuracy < 0.5),
        correctCount: hasCounts ? correct : 0,
        totalCount: hasCounts ? total : 0,
        hasCounts,
        level: cp.level,
      });
    } else {
      if (hasCounts) {
        existing.correctCount += correct;
        existing.totalCount += total;
        existing.hasCounts = true;
      }
      if (cp.level === "Weak" || (typeof cp.accuracy === "number" && cp.accuracy < 0.5)) {
        existing.hasWeak = true;
      }
    }
  }

  const totalAssessedConceptCount = conceptMap.size;
  if (totalAssessedConceptCount === 0) {
    return false;
  }

  let weakConceptCount = 0;
  for (const entry of conceptMap.values()) {
    let isWeak = false;
    if (entry.hasCounts && entry.totalCount > 0) {
      const accuracy = entry.correctCount / entry.totalCount;
      isWeak = classifyConceptLevel(accuracy) === "Weak";
    } else {
      isWeak = entry.hasWeak || entry.level === "Weak";
    }

    if (isWeak) {
      weakConceptCount += 1;
    }
  }

  const weakConceptRatio = weakConceptCount / totalAssessedConceptCount;
  return weakConceptRatio > 0.40;
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
