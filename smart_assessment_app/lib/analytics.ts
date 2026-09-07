import { classifyConceptLevel, determinePassFail, type ConceptLevel } from "./conceptEngine";

export type ProfileData = {
  id: string;
  name: string;
};

export type ClassMemberData = {
  student_id: string;
};

export type AttemptData = {
  id: string;
  student_id: string;
  score: number | null;
  total: number | null;
  started_at: string;
  submitted_at: string | null;
};

export type ConceptPerfData = {
  attempt_id: string;
  concept: string;
  correct_count: number;
  total_count: number;
  accuracy: number;
  level: string; // "Strong" | "Medium" | "Weak"
};

export type AffectedStudent = {
  student_id: string;
  name: string;
  accuracyPercentage: number;
};

export type ClassConceptResult = {
  concept: string;
  accuracyPercentage: number;
  level: ConceptLevel;
  affectedStudents: AffectedStudent[];
};

export type StudentResult = {
  student_id: string;
  attempt_id: string | null;
  name: string;
  status: "Completed" | "In Progress" | "Not Started";
  score: number | null;
  total: number | null;
  percentage: number | null;
  passFail: "Pass" | "Fail" | null;
  isWeakStudent: boolean;
  startedAt: string | null;
  submittedAt: string | null;
};

export type ClassPerformanceResult = {
  overview: {
    totalStudents: number;
    completed: number;
    inProgress: number;
    passed: number;
    failed: number;
  };
  weakConcepts: ClassConceptResult[];
  mediumConcepts: ClassConceptResult[];
  studentResults: StudentResult[];
};

function selectLatestAttempt(current: AttemptData | undefined, candidate: AttemptData): AttemptData {
  if (!current) return candidate;

  const currentIsSubmitted = current.submitted_at !== null;
  const candidateIsSubmitted = candidate.submitted_at !== null;

  if (candidateIsSubmitted !== currentIsSubmitted) {
    return candidateIsSubmitted ? candidate : current;
  }

  const currentTimestamp = current.submitted_at ?? current.started_at;
  const candidateTimestamp = candidate.submitted_at ?? candidate.started_at;

  return candidateTimestamp > currentTimestamp ? candidate : current;
}

export function aggregateClassPerformance(
  members: ClassMemberData[],
  profiles: ProfileData[],
  attempts: AttemptData[],
  conceptPerfs: ConceptPerfData[]
): ClassPerformanceResult {
  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));
  const attemptByStudent = new Map<string, AttemptData>();
  for (const attempt of attempts) {
    attemptByStudent.set(attempt.student_id, selectLatestAttempt(attemptByStudent.get(attempt.student_id), attempt));
  }
  const perfByAttempt = new Map<string, ConceptPerfData[]>();

  for (const cp of conceptPerfs) {
    const list = perfByAttempt.get(cp.attempt_id) ?? [];
    list.push(cp);
    perfByAttempt.set(cp.attempt_id, list);
  }

  let completed = 0;
  let inProgress = 0;
  let passed = 0;
  let failed = 0;

  const studentResults: StudentResult[] = [];
  const conceptAggregates = new Map<string, { correct: number; total: number }>();
  const completedAttemptIds = new Set<string>();

  for (const member of members) {
    const name = profileMap.get(member.student_id) ?? "Unknown Student";
    const attempt = attemptByStudent.get(member.student_id);

    let status: StudentResult["status"] = "Not Started";
    let isWeakStudent = false;
    let passFail: "Pass" | "Fail" | null = null;
    let percentage: number | null = null;

    if (attempt) {
      if (attempt.submitted_at) {
        status = "Completed";
        completed++;
        completedAttemptIds.add(attempt.id);

        passFail = determinePassFail(attempt.score ?? 0, attempt.total ?? 0);
        if (passFail === "Pass") passed++;
        else failed++;

        if (attempt.total && attempt.total > 0) {
          percentage = Number((((attempt.score ?? 0) / attempt.total) * 100).toFixed(2));
        }

        const studentPerfs = perfByAttempt.get(attempt.id) ?? [];
        isWeakStudent = studentPerfs.some((cp) => cp.level === "Weak");
      } else {
        status = "In Progress";
        inProgress++;
      }
    }

    studentResults.push({
      student_id: member.student_id,
      attempt_id: attempt?.id ?? null,
      name,
      status,
      score: attempt?.submitted_at ? (attempt.score ?? 0) : null,
      total: attempt?.submitted_at ? (attempt.total ?? 0) : null,
      percentage,
      passFail,
      isWeakStudent,
      startedAt: attempt?.started_at ?? null,
      submittedAt: attempt?.submitted_at ?? null,
    });
  }

  // Aggregate concept performance across COMPLETED attempts only
  for (const cp of conceptPerfs) {
    if (!completedAttemptIds.has(cp.attempt_id)) continue;
    
    const agg = conceptAggregates.get(cp.concept) ?? { correct: 0, total: 0 };
    agg.correct += cp.correct_count;
    agg.total += cp.total_count;
    conceptAggregates.set(cp.concept, agg);
  }

  const weakConcepts: ClassConceptResult[] = [];
  const mediumConcepts: ClassConceptResult[] = [];

  for (const [concept, agg] of conceptAggregates.entries()) {
    if (agg.total === 0) continue;
    const ratio = agg.correct / agg.total;
    const level = classifyConceptLevel(ratio);
    const accuracyPercentage = Number((ratio * 100).toFixed(2));

    if (level === "Strong") continue; // We only care about Weak and Medium

    const affectedStudents: AffectedStudent[] = [];

    // Find affected students
    for (const member of members) {
      const attempt = attemptByStudent.get(member.student_id);
      if (!attempt || !attempt.submitted_at) continue;

      const studentPerfs = perfByAttempt.get(attempt.id) ?? [];
      const studentCp = studentPerfs.find((cp) => cp.concept === concept);

      if (studentCp) {
        const studentLevel = classifyConceptLevel(studentCp.accuracy);
        // Student is affected if their personal concept level matches the class concept level bucket (Weak/Medium)
        if (studentLevel === level) {
          affectedStudents.push({
            student_id: member.student_id,
            name: profileMap.get(member.student_id) ?? "Unknown Student",
            accuracyPercentage: Number((studentCp.accuracy * 100).toFixed(2)),
          });
        }
      }
    }

    // Sort affected students alphabetically
    affectedStudents.sort((a, b) => a.name.localeCompare(b.name));

    const result: ClassConceptResult = {
      concept,
      accuracyPercentage,
      level,
      affectedStudents,
    };

    if (level === "Weak") {
      weakConcepts.push(result);
    } else if (level === "Medium") {
      mediumConcepts.push(result);
    }
  }

  // Sort concepts by accuracy (lowest first)
  weakConcepts.sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);
  mediumConcepts.sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

  // Sort student results (completed first, then by score descending)
  studentResults.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "Completed") return -1;
      if (b.status === "Completed") return 1;
      if (a.status === "In Progress") return -1;
      if (b.status === "In Progress") return 1;
    }
    if (a.percentage !== null && b.percentage !== null) {
      return b.percentage - a.percentage;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    overview: {
      totalStudents: members.length,
      completed,
      inProgress,
      passed,
      failed,
    },
    weakConcepts,
    mediumConcepts,
    studentResults,
  };
}
