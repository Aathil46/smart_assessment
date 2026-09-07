import { describe, expect, it } from "vitest";
import { aggregateClassPerformance } from "@/lib/analytics";

describe("Phase 6 — Analytics Service (aggregateClassPerformance)", () => {
  const members = [{ student_id: "s1" }];
  const profiles = [{ id: "s1", name: "Student One" }];

  it("selects a submitted attempt", () => {
    const result = aggregateClassPerformance(
      members,
      profiles,
      [{ id: "submitted", student_id: "s1", score: 8, total: 10, started_at: "2024-01-01T10:00:00Z", submitted_at: "2024-01-01T10:30:00Z" }],
      []
    );

    expect(result.studentResults[0]).toMatchObject({ attempt_id: "submitted", status: "Completed", percentage: 80 });
  });

  it("selects an in-progress attempt when there is no submitted attempt", () => {
    const result = aggregateClassPerformance(
      members,
      profiles,
      [{ id: "in-progress", student_id: "s1", score: null, total: null, started_at: "2024-01-01T10:00:00Z", submitted_at: null }],
      []
    );

    expect(result.studentResults[0]).toMatchObject({ attempt_id: "in-progress", status: "In Progress" });
  });

  it.each([
    [
      "submitted then in-progress",
      [
        { id: "submitted", student_id: "s1", score: 8, total: 10, started_at: "2024-01-01T10:00:00Z", submitted_at: "2024-01-01T10:30:00Z" },
        { id: "in-progress", student_id: "s1", score: null, total: null, started_at: "2024-01-02T10:00:00Z", submitted_at: null },
      ],
    ],
    [
      "in-progress then submitted",
      [
        { id: "in-progress", student_id: "s1", score: null, total: null, started_at: "2024-01-02T10:00:00Z", submitted_at: null },
        { id: "submitted", student_id: "s1", score: 8, total: 10, started_at: "2024-01-01T10:00:00Z", submitted_at: "2024-01-01T10:30:00Z" },
      ],
    ],
  ])("prefers the submitted attempt for duplicate attempts (%s)", (_, attempts) => {
    const result = aggregateClassPerformance(members, profiles, attempts, []);

    expect(result.studentResults[0]).toMatchObject({ attempt_id: "submitted", status: "Completed" });
  });

  it("selects the latest submitted attempt when there are multiple submitted attempts", () => {
    const result = aggregateClassPerformance(
      members,
      profiles,
      [
        { id: "latest-submitted", student_id: "s1", score: 9, total: 10, started_at: "2024-01-02T10:00:00Z", submitted_at: "2024-01-02T10:30:00Z" },
        { id: "older-submitted", student_id: "s1", score: 5, total: 10, started_at: "2024-01-01T10:00:00Z", submitted_at: "2024-01-01T10:30:00Z" },
      ],
      []
    );

    expect(result.studentResults[0]).toMatchObject({ attempt_id: "latest-submitted", score: 9, percentage: 90 });
  });

  it("computes overview stats correctly based on enrolled students", () => {
    const members = [
      { student_id: "s1" },
      { student_id: "s2" },
      { student_id: "s3" },
      { student_id: "s4" },
    ];
    const profiles = [
      { id: "s1", name: "Aathil" },
      { id: "s2", name: "Bala" },
      { id: "s3", name: "Celine" },
      { id: "s4", name: "Divya" },
    ];
    const attempts = [
      // Completed, Passed
      { id: "a1", student_id: "s1", score: 8, total: 10, started_at: "2024", submitted_at: "2024" },
      // Completed, Failed
      { id: "a2", student_id: "s2", score: 4, total: 10, started_at: "2024", submitted_at: "2024" },
      // In Progress
      { id: "a3", student_id: "s3", score: null, total: null, started_at: "2024", submitted_at: null },
      // s4 has no attempt
    ];
    const conceptPerfs: any[] = [];

    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);
    
    expect(result.overview.totalStudents).toBe(4);
    expect(result.overview.completed).toBe(2); // s1, s2
    expect(result.overview.inProgress).toBe(1); // s3
    expect(result.overview.passed).toBe(1); // s1
    expect(result.overview.failed).toBe(1); // s2

    const sr1 = result.studentResults.find(s => s.student_id === "s1");
    expect(sr1?.status).toBe("Completed");
    expect(sr1?.passFail).toBe("Pass");

    const sr3 = result.studentResults.find(s => s.student_id === "s3");
    expect(sr3?.status).toBe("In Progress");

    const sr4 = result.studentResults.find(s => s.student_id === "s4");
    expect(sr4?.status).toBe("Not Started");
  });

  it("aggregates concept performance using only completed attempts and underlying counts", () => {
    const members = [
      { student_id: "s1" },
      { student_id: "s2" },
      { student_id: "s3" }, // Incomplete attempt, should be ignored for concept aggregations
    ];
    const profiles = members.map(m => ({ id: m.student_id, name: `Student ${m.student_id}` }));
    
    const attempts = [
      { id: "a1", student_id: "s1", score: 5, total: 10, started_at: "T1", submitted_at: "T2" },
      { id: "a2", student_id: "s2", score: 5, total: 10, started_at: "T1", submitted_at: "T2" },
      { id: "a3", student_id: "s3", score: 5, total: 10, started_at: "T1", submitted_at: null },
    ];

    const conceptPerfs = [
      // s1 Weak on ConceptA (1/3 = 33%)
      { attempt_id: "a1", concept: "ConceptA", correct_count: 1, total_count: 3, accuracy: 0.333, level: "Weak" },
      // s2 Medium on ConceptA (2/3 = 66%)
      { attempt_id: "a2", concept: "ConceptA", correct_count: 2, total_count: 3, accuracy: 0.667, level: "Medium" },
      // s3 Strong on ConceptA (3/3 = 100%) - BUT incomplete, so ignored
      { attempt_id: "a3", concept: "ConceptA", correct_count: 3, total_count: 3, accuracy: 1.0, level: "Strong" },
    ];

    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);

    // Class ConceptA:
    // Only a1 and a2 are complete.
    // Total correct = 1 + 2 = 3
    // Total count = 3 + 3 = 6
    // Accuracy = 3/6 = 50% -> Medium
    
    expect(result.mediumConcepts).toHaveLength(1);
    expect(result.mediumConcepts[0].concept).toBe("ConceptA");
    expect(result.mediumConcepts[0].accuracyPercentage).toBe(50.0);
    expect(result.weakConcepts).toHaveLength(0);

    // Affected students should ONLY include s2 because s2's individual level (Medium) matches the class level (Medium)
    const affected = result.mediumConcepts[0].affectedStudents;
    expect(affected).toHaveLength(1);
    expect(affected[0].student_id).toBe("s2");
  });

  it("handles weak concepts and includes affected students correctly", () => {
    const members = [{ student_id: "s1" }, { student_id: "s2" }, { student_id: "s3" }];
    const profiles = members.map(m => ({ id: m.student_id, name: `Student ${m.student_id}` }));
    
    const attempts = members.map(m => ({
      id: `a_${m.student_id}`, student_id: m.student_id, score: 5, total: 10, started_at: "T1", submitted_at: "T2" 
    }));

    const conceptPerfs = [
      // Class total: 1+2+1 = 4 correct out of 15 (26.6% -> Weak)
      { attempt_id: "a_s1", concept: "Photosynthesis", correct_count: 1, total_count: 5, accuracy: 0.2, level: "Weak" },
      { attempt_id: "a_s2", concept: "Photosynthesis", correct_count: 2, total_count: 5, accuracy: 0.4, level: "Weak" },
      { attempt_id: "a_s3", concept: "Photosynthesis", correct_count: 1, total_count: 5, accuracy: 0.2, level: "Weak" },
    ];

    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);

    expect(result.weakConcepts).toHaveLength(1);
    const wc = result.weakConcepts[0];
    expect(wc.concept).toBe("Photosynthesis");
    expect(wc.level).toBe("Weak");
    // All 3 students are affected (their individual level is Weak)
    expect(wc.affectedStudents).toHaveLength(3);
    
    // Check sorting of students alphabetically
    expect(wc.affectedStudents[0].name).toBe("Student s1");
    expect(wc.affectedStudents[1].name).toBe("Student s2");
    expect(wc.affectedStudents[2].name).toBe("Student s3");
  });

  it("correctly identifies Weak Student status", () => {
    const members = [{ student_id: "s1" }, { student_id: "s2" }];
    const profiles = members.map(m => ({ id: m.student_id, name: `Student ${m.student_id}` }));
    
    const attempts = members.map(m => ({
      id: `a_${m.student_id}`, student_id: m.student_id, score: 7, total: 10, started_at: "T1", submitted_at: "T2" 
    }));

    const conceptPerfs = [
      { attempt_id: "a_s1", concept: "C1", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a_s1", concept: "C2", correct_count: 0, total_count: 5, accuracy: 0.0, level: "Weak" }, // s1 is Weak
      
      { attempt_id: "a_s2", concept: "C1", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
      { attempt_id: "a_s2", concept: "C2", correct_count: 3, total_count: 5, accuracy: 0.6, level: "Medium" }, // s2 is not Weak
    ];

    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);
    
    const sr1 = result.studentResults.find(s => s.student_id === "s1");
    const sr2 = result.studentResults.find(s => s.student_id === "s2");

    expect(sr1?.isWeakStudent).toBe(true);
    expect(sr2?.isWeakStudent).toBe(false);
  });
});
