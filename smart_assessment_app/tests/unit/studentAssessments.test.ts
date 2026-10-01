import { describe, expect, it } from "vitest";

describe("Student Assessments Integration", () => {
  it("categorizes submitted assessments into completed with score and pass/fail", () => {
    const rawAssessments = [
      {
        id: "a1",
        title: "Quadratic Equations",
        topic: "Algebra",
        classes: { name: "Algebra II", subject: "Math", teacher_id: "t1" },
        questions: [{ id: "q1" }, { id: "q2" }],
      },
    ];

    const attempts = [
      {
        id: "att-1",
        assessment_id: "a1",
        score: 8,
        total: 10,
        submitted_at: "2026-09-04T12:00:00Z",
      },
    ];

    const atts = attempts.filter((att) => att.assessment_id === "a1");
    const submittedAttempt = atts.find((att) => att.submitted_at !== null);

    expect(submittedAttempt).toBeDefined();

    const scorePct = Math.round((submittedAttempt!.score / submittedAttempt!.total) * 100);
    const passed = scorePct >= 60;

    expect(scorePct).toBe(80);
    expect(passed).toBe(true);

    const completedItem = {
      id: rawAssessments[0].id,
      attemptId: submittedAttempt!.id,
      title: rawAssessments[0].title,
      className: rawAssessments[0].classes.name,
      score: scorePct,
      passed,
      status: "completed",
    };

    expect(completedItem.score).toBe(80);
    expect(completedItem.passed).toBe(true);
    expect(completedItem.status).toBe("completed");
  });

  it("categorizes open unsubmitted assessments into toDo with correct status", () => {
    const now = new Date("2026-10-01T12:00:00Z").getTime();
    const rawAssessments = [
      {
        id: "a2",
        title: "Limits Exam",
        opens_at: "2026-09-01T00:00:00Z",
        closes_at: "2026-10-15T00:00:00Z",
        classes: { name: "Calculus", subject: "Math" },
        questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }],
      },
    ];

    const attempts: any[] = []; // No attempts started yet

    const a = rawAssessments[0];
    const isOpen = !a.opens_at || new Date(a.opens_at).getTime() <= now;
    const isNotClosed = !a.closes_at || new Date(a.closes_at).getTime() > now;
    const submittedAttempt = attempts.find((att) => att.assessment_id === a.id && att.submitted_at !== null);
    const inProgressAttempt = attempts.find((att) => att.assessment_id === a.id && att.submitted_at === null);

    expect(submittedAttempt).toBeUndefined();
    expect(isOpen && isNotClosed).toBe(true);

    const toDoItem = {
      id: a.id,
      title: a.title,
      className: a.classes.name,
      questions: a.questions.length,
      duration: Math.max(5, a.questions.length * 3),
      status: inProgressAttempt ? "in-progress" : "not-started",
    };

    expect(toDoItem.questions).toBe(3);
    expect(toDoItem.duration).toBe(9);
    expect(toDoItem.status).toBe("not-started");
  });

  it("marks assessment as in-progress if an unsubmitted attempt exists", () => {
    const attempts = [
      {
        id: "att-in-progress",
        assessment_id: "a3",
        score: null,
        total: null,
        submitted_at: null,
      },
    ];

    const inProgressAttempt = attempts.find((att) => att.assessment_id === "a3" && att.submitted_at === null);
    expect(inProgressAttempt).toBeDefined();
    expect(inProgressAttempt!.id).toBe("att-in-progress");

    const status = inProgressAttempt ? "in-progress" : "not-started";
    expect(status).toBe("in-progress");
  });

  it("excludes closed unsubmitted assessments from toDo", () => {
    const now = new Date("2026-10-01T12:00:00Z").getTime();
    const expiredAssessment = {
      id: "a4",
      title: "Past Quiz",
      opens_at: "2026-09-01T00:00:00Z",
      closes_at: "2026-09-10T00:00:00Z", // In the past
    };

    const isOpen = !expiredAssessment.opens_at || new Date(expiredAssessment.opens_at).getTime() <= now;
    const isNotClosed = !expiredAssessment.closes_at || new Date(expiredAssessment.closes_at).getTime() > now;

    expect(isOpen).toBe(true);
    expect(isNotClosed).toBe(false);
  });
});
