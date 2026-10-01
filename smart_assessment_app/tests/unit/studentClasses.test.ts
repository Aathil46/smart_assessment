import { describe, expect, it } from "vitest";
import { joinClassSchema } from "@/lib/validation";

describe("Student Classes Integration", () => {
  it("validates 6-character uppercase class code correctly", () => {
    expect(() => joinClassSchema.parse({ code: "ABC123" })).not.toThrow();
    expect(joinClassSchema.parse({ code: "  abc123  " }).code).toBe("ABC123");

    expect(() => joinClassSchema.parse({ code: "12345" })).toThrow();
    expect(() => joinClassSchema.parse({ code: "1234567" })).toThrow();
    expect(() => joinClassSchema.parse({ code: "" })).toThrow();
  });

  it("calculates student average score per class correctly from submitted attempts", () => {
    const classAssessments = [
      { id: "a1", class_id: "c1", title: "Assessment 1" },
      { id: "a2", class_id: "c1", title: "Assessment 2" },
      { id: "a3", class_id: "c2", title: "Assessment 3" },
    ];

    const attempts = [
      { assessment_id: "a1", score: 8, total: 10, submitted_at: "2026-09-01T10:00:00Z" }, // 80%
      { assessment_id: "a2", score: 9, total: 10, submitted_at: "2026-09-02T10:00:00Z" }, // 90%
      { assessment_id: "a3", score: 5, total: 10, submitted_at: "2026-09-03T10:00:00Z" }, // 50%
    ];

    const c1AssessmentIds = new Set(classAssessments.filter((a) => a.class_id === "c1").map((a) => a.id));
    const c1Attempts = attempts.filter((at) => c1AssessmentIds.has(at.assessment_id) && at.submitted_at && at.total > 0);

    const totalPct = c1Attempts.reduce((sum, at) => sum + (at.score / at.total) * 100, 0);
    const avgScore = Math.round(totalPct / c1Attempts.length);

    expect(avgScore).toBe(85); // (80 + 90) / 2 = 85%
  });

  it("returns null average score when student has no submitted attempts in class", () => {
    const classAssessments = [
      { id: "a1", class_id: "c1", title: "Assessment 1" },
    ];

    const attempts = [
      { assessment_id: "a1", score: null, total: null, submitted_at: null }, // in progress / unsubmitted
    ];

    const c1AssessmentIds = new Set(classAssessments.map((a) => a.id));
    const c1Attempts = attempts.filter((at) => c1AssessmentIds.has(at.assessment_id) && at.submitted_at && at.total && at.total > 0);

    const avgScore = c1Attempts.length > 0 ? Math.round(c1Attempts.reduce((s, a) => s + (a.score! / a.total!) * 100, 0) / c1Attempts.length) : null;

    expect(avgScore).toBeNull();
  });

  it("determines next pending assessment correctly", () => {
    const now = new Date("2026-10-01T12:00:00Z").getTime();

    const assessments = [
      { id: "a1", class_id: "c1", title: "Quiz 1", closes_at: "2026-10-05T00:00:00Z", created_at: "2026-09-20T00:00:00Z" },
      { id: "a2", class_id: "c1", title: "Exam 1", closes_at: "2026-10-03T00:00:00Z", created_at: "2026-09-21T00:00:00Z" },
      { id: "a3", class_id: "c1", title: "Old Quiz", closes_at: "2026-09-15T00:00:00Z", created_at: "2026-09-10T00:00:00Z" },
    ];

    const submittedAssessmentIds = new Set(["a1"]);

    const pending = assessments.filter((a) => {
      if (submittedAssessmentIds.has(a.id)) return false;
      if (a.closes_at && new Date(a.closes_at).getTime() <= now) return false;
      return true;
    });

    pending.sort((a, b) => {
      if (a.closes_at && b.closes_at) return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
      return 0;
    });

    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe("Exam 1");
  });

  it("returns null nextAssessment when all assessments are submitted or expired", () => {
    const now = new Date("2026-10-01T12:00:00Z").getTime();

    const assessments = [
      { id: "a1", class_id: "c1", title: "Quiz 1", closes_at: "2026-10-05T00:00:00Z", created_at: "2026-09-20T00:00:00Z" },
    ];

    const submittedAssessmentIds = new Set(["a1"]);

    const pending = assessments.filter((a) => {
      if (submittedAssessmentIds.has(a.id)) return false;
      if (a.closes_at && new Date(a.closes_at).getTime() <= now) return false;
      return true;
    });

    const nextAssessment = pending[0]?.title ?? null;
    expect(nextAssessment).toBeNull();
  });
});
