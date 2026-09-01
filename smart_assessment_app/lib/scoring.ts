import {
  classifyConceptLevel,
  detectLearningGaps,
  determinePassFail,
  evaluateAttempt,
  isWeakStudent,
  type ConceptLevel,
  type ConceptPerformanceResult,
  type LearningGapResult,
  type PassFailStatus,
  type ScoringAnswer,
  type ScoringQuestion,
} from "./conceptEngine";

export type {
  ConceptLevel,
  ConceptPerformanceResult,
  LearningGapResult,
  PassFailStatus,
  ScoringAnswer,
  ScoringQuestion,
};

export type ConceptPerformance = {
  concept: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  level?: ConceptLevel;
};

export type LearningGap = {
  concept: string;
  mastery: number;
  level: string;
};

/**
 * Deterministically scores assessment attempt.
 * Preserves V2 baseline scoring contract while calculating accurate concept performance.
 */
export function scoreAttempt(questions: ScoringQuestion[], answers: ScoringAnswer[]) {
  const evaluation = evaluateAttempt(questions, answers);

  return {
    score: evaluation.score,
    total: evaluation.total,
    percentage: evaluation.percentage,
    passFail: evaluation.passFail,
    isWeakStudent: evaluation.isWeakStudent,
    conceptPerformance: evaluation.conceptPerformance.map((cp) => ({
      concept: cp.concept,
      correctCount: cp.correctCount,
      totalCount: cp.totalCount,
      accuracy: cp.accuracy,
      level: cp.level,
    })),
  };
}

/**
 * Derives learning gaps according to V3 rules (Weak concepts only).
 */
export function deriveLearningGaps(performance: ConceptPerformance[]): LearningGap[] {
  const asResults: ConceptPerformanceResult[] = performance.map((p) => ({
    concept: p.concept,
    correctCount: p.correctCount,
    totalCount: p.totalCount,
    accuracy: p.accuracy,
    accuracyPercentage: Number((p.accuracy * 100).toFixed(2)),
    level: p.level ?? classifyConceptLevel(p.accuracy),
  }));

  return detectLearningGaps(asResults).map((gap) => ({
    concept: gap.concept,
    mastery: gap.mastery,
    level: gap.level,
  }));
}

export { classifyConceptLevel, determinePassFail, evaluateAttempt, isWeakStudent };