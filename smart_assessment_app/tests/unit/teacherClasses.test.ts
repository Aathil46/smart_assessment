import { describe, expect, it } from "vitest";

describe("Teacher Classes & ClassDetail Integration", () => {
  it("correctly aggregates student count, assessment count, and average performance per class", () => {
    const classes = [
      { id: "class-1", name: "Grade 10 Math", code: "MTH101" },
      { id: "class-2", name: "Physics 101", code: "PHY101" },
    ];

    const classMembers = [
      { class_id: "class-1", student_id: "s1" },
      { class_id: "class-1", student_id: "s2" },
      { class_id: "class-2", student_id: "s3" },
    ];

    const assessments = [
      { id: "a1", class_id: "class-1" },
      { id: "a2", class_id: "class-1" },
      { id: "a3", class_id: "class-2" },
    ];

    const attempts = [
      { assessment_id: "a1", score: 8, total: 10, submitted_at: "2026-09-01" },
      { assessment_id: "a2", score: 9, total: 10, submitted_at: "2026-09-02" },
      { assessment_id: "a3", score: 5, total: 10, submitted_at: "2026-09-03" },
    ];

    // Compute student counts
    const studentCounts: Record<string, number> = {};
    for (const m of classMembers) {
      studentCounts[m.class_id] = (studentCounts[m.class_id] || 0) + 1;
    }

    // Compute assessment counts
    const assessmentCounts: Record<string, number> = {};
    const assessmentIdsByClass: Record<string, string[]> = {};
    for (const a of assessments) {
      assessmentCounts[a.class_id] = (assessmentCounts[a.class_id] || 0) + 1;
      if (!assessmentIdsByClass[a.class_id]) assessmentIdsByClass[a.class_id] = [];
      assessmentIdsByClass[a.class_id].push(a.id);
    }

    // Compute average performance per class
    const avgPerformances: Record<string, number | null> = {};
    for (const cls of classes) {
      const ids = new Set(assessmentIdsByClass[cls.id] || []);
      const classAttempts = attempts.filter((at) => ids.has(at.assessment_id) && at.total && at.total > 0);
      if (classAttempts.length > 0) {
        const totalPct = classAttempts.reduce((sum, at) => sum + (at.score / at.total) * 100, 0);
        avgPerformances[cls.id] = Math.round(totalPct / classAttempts.length);
      } else {
        avgPerformances[cls.id] = null;
      }
    }

    expect(studentCounts["class-1"]).toBe(2);
    expect(studentCounts["class-2"]).toBe(1);
    expect(assessmentCounts["class-1"]).toBe(2);
    expect(assessmentCounts["class-2"]).toBe(1);
    expect(avgPerformances["class-1"]).toBe(85); // (80 + 90) / 2 = 85
    expect(avgPerformances["class-2"]).toBe(50);
  });

  it("calculates class detail student breakdown and participation rate accurately", () => {
    const studentCount = 4;
    const publishedAssessmentsCount = 2;
    const totalExpected = studentCount * publishedAssessmentsCount; // 8 expected submissions

    const attempts = [
      { assessment_id: "a1", student_id: "s1", submitted_at: "2026-09-01", started_at: "2026-09-01" },
      { assessment_id: "a1", student_id: "s2", submitted_at: "2026-09-01", started_at: "2026-09-01" },
      { assessment_id: "a2", student_id: "s1", submitted_at: "2026-09-02", started_at: "2026-09-02" },
      { assessment_id: "a2", student_id: "s3", submitted_at: null, started_at: "2026-09-02" }, // in progress
    ];

    const completedCount = attempts.filter((a) => a.submitted_at).length; // 3
    const inProgressCount = attempts.filter((a) => a.started_at && !a.submitted_at).length; // 1
    const notStartedCount = totalExpected - completedCount - inProgressCount; // 4

    const completedPct = Math.round((completedCount / totalExpected) * 100); // 3/8 = 38% (rounded)
    const inProgressPct = Math.round((inProgressCount / totalExpected) * 100); // 1/8 = 13% (rounded)
    const notStartedPct = Math.max(0, 100 - completedPct - inProgressPct);

    expect(completedCount).toBe(3);
    expect(inProgressCount).toBe(1);
    expect(notStartedCount).toBe(4);
    expect(completedPct).toBe(38);
    expect(inProgressPct).toBe(13);
    expect(notStartedPct).toBe(49);
    expect(completedPct + inProgressPct + notStartedPct).toBe(100);
  });
});
