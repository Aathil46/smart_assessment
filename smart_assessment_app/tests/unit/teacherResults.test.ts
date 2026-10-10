import { describe, expect, it } from "vitest";
import { classifyConceptLevel, determinePassFail } from "@/lib/conceptEngine";

describe("Teacher Results & Analytics Integration", () => {
  it("correctly computes completed attempts, average score, and pass rate", () => {
    const attempts = [
      { score: 8, total: 10, submitted_at: "2026-09-01T10:00:00Z" },
      { score: 4, total: 10, submitted_at: "2026-09-01T10:05:00Z" },
      { score: null, total: null, submitted_at: null }, // in progress
    ];

    const submitted = attempts.filter((a) => a.submitted_at);
    expect(submitted.length).toBe(2);

    let passCount = 0;
    let totalPct = 0;

    for (const att of submitted) {
      const score = att.score ?? 0;
      const total = att.total && att.total > 0 ? att.total : 1;
      const pct = (score / total) * 100;
      totalPct += pct;
      if (determinePassFail(score, total) === "Pass") {
        passCount++;
      }
    }

    const avgScore = Math.round(totalPct / submitted.length);
    const passRate = Math.round((passCount / submitted.length) * 100);

    expect(avgScore).toBe(60); // (80 + 40) / 2 = 60
    expect(passRate).toBe(50); // 1 passed, 1 failed = 50%
  });

  it("correctly categorizes concepts into strong, medium, and weak", () => {
    const rawConcepts = [
      { concept: "Factoring", accuracy: 0.9 },
      { concept: "Quadratic Formula", accuracy: 0.65 },
      { concept: "Discriminant", accuracy: 0.3 },
    ];

    const mapped = rawConcepts.map((c) => {
      const level = classifyConceptLevel(c.accuracy);
      const mastery = level === "Strong" ? "strong" : level === "Medium" ? "medium" : "weak";
      return { concept: c.concept, score: Math.round(c.accuracy * 100), mastery };
    });

    const strong = mapped.filter((c) => c.mastery === "strong");
    const medium = mapped.filter((c) => c.mastery === "medium");
    const weak = mapped.filter((c) => c.mastery === "weak");

    expect(strong.length).toBe(1);
    expect(strong[0].concept).toBe("Factoring");
    expect(strong[0].score).toBe(90);

    expect(medium.length).toBe(1);
    expect(medium[0].concept).toBe("Quadratic Formula");
    expect(medium[0].score).toBe(65);

    expect(weak.length).toBe(1);
    expect(weak[0].concept).toBe("Discriminant");
    expect(weak[0].score).toBe(30);
  });

  it("includes roll_number in student results and handles missing roll numbers gracefully", async () => {
    const { aggregateClassPerformance } = await import("@/lib/analytics");
    const members = [{ student_id: "s1" }, { student_id: "s2" }];
    const profiles = [
      { id: "s1", name: "Aashik", roll_number: "23CS101" },
      { id: "s2", name: "Kavitha" }, // no roll number
    ];
    const attempts = [
      { id: "a1", student_id: "s1", score: 9, total: 10, started_at: "2026-09-01T10:00:00Z", submitted_at: "2026-09-01T10:20:00Z" },
      { id: "a2", student_id: "s2", score: 8, total: 10, started_at: "2026-09-01T10:00:00Z", submitted_at: "2026-09-01T10:20:00Z" },
    ];
    const res = aggregateClassPerformance(members, profiles, attempts, []);

    const s1 = res.studentResults.find((s) => s.student_id === "s1");
    const s2 = res.studentResults.find((s) => s.student_id === "s2");

    expect(s1?.name).toBe("Aashik");
    expect(s1?.roll_number).toBe("23CS101");
    expect(s2?.name).toBe("Kavitha");
    expect(s2?.roll_number).toBeNull();
  });

  it("filters and searches students by both name and roll number", () => {
    const students = [
      { name: "Aashik", rollNumber: "23CS101" },
      { name: "Bala", rollNumber: "23CS102" },
      { name: "Kavitha", rollNumber: null },
    ];

    // Search by roll number
    const q1 = "23CS101";
    const match1 = students.filter(
      (s) => s.name.toLowerCase().includes(q1.toLowerCase()) || (s.rollNumber && s.rollNumber.toLowerCase().includes(q1.toLowerCase()))
    );
    expect(match1).toHaveLength(1);
    expect(match1[0].name).toBe("Aashik");

    // Search by name
    const q2 = "kav";
    const match2 = students.filter(
      (s) => s.name.toLowerCase().includes(q2.toLowerCase()) || (s.rollNumber && s.rollNumber.toLowerCase().includes(q2.toLowerCase()))
    );
    expect(match2).toHaveLength(1);
    expect(match2[0].name).toBe("Kavitha");

    // Filter by specific roll number
    const filtered = students.filter((s) => s.rollNumber === "23CS102");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Bala");
  });

  describe("Calendar-style Multi-Month Filtering for Teacher Results", () => {
    const mockAssessments = [
      {
        id: "a1",
        title: "Algebra Basics",
        description: "Introductory algebra test",
        displayClass: "Grade 10A",
        createdAt: "Sep 15, 2026",
        createdAtRaw: "2026-09-15T10:00:00Z",
        status: "published" as const,
      },
      {
        id: "a2",
        title: "Geometry Midterm",
        description: "Shapes and triangles",
        displayClass: "Grade 10B",
        createdAt: "Oct 02, 2026",
        createdAtRaw: "2026-10-02T14:30:00Z",
        status: "published" as const,
      },
      {
        id: "a3",
        title: "Trigonometry Final",
        description: "Sine and cosine identities",
        displayClass: "Grade 10A",
        createdAt: "Dec 10, 2025",
        createdAtRaw: "2025-12-10T09:00:00Z",
        status: "published" as const,
      },
      {
        id: "a4",
        title: "Legacy Assessment",
        description: "Invalid date record",
        displayClass: "Grade 10A",
        createdAt: "—",
        createdAtRaw: undefined,
        status: "published" as const,
      },
    ];

    function getMonthKey(item: { createdAt: string; createdAtRaw?: string }): string | null {
      const dateStr = item.createdAtRaw || item.createdAt;
      if (!dateStr || dateStr === "—") return null;
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return null;
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }

    function filterAssessments(
      items: typeof mockAssessments,
      selectedMonths: string[],
      filterClass: string = "all",
      searchQuery: string = ""
    ) {
      let list = items;

      if (filterClass !== "all") {
        list = list.filter((a) => a.displayClass === filterClass);
      }

      if (selectedMonths.length > 0) {
        const set = new Set(selectedMonths);
        list = list.filter((a) => {
          const key = getMonthKey(a);
          return key !== null && set.has(key);
        });
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
        );
      }

      return list;
    }

    it("returns all assessments when no months are selected (empty-selection behavior)", () => {
      const results = filterAssessments(mockAssessments, []);
      expect(results).toHaveLength(4);
    });

    it("filters correctly by a single selected month", () => {
      const results = filterAssessments(mockAssessments, ["2026-10"]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Geometry Midterm");
    });

    it("filters assessments belonging to ANY of the selected multiple months across years", () => {
      const results = filterAssessments(mockAssessments, ["2025-12", "2026-10"]);
      expect(results).toHaveLength(2);
      const titles = results.map((r) => r.title);
      expect(titles).toContain("Geometry Midterm");
      expect(titles).toContain("Trigonometry Final");
    });

    it("handles assessments with missing or invalid dates safely without throwing", () => {
      const results = filterAssessments(mockAssessments, ["2026-09"]);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Algebra Basics");

      // Invalid date key extraction
      expect(getMonthKey(mockAssessments[3])).toBeNull();
    });

    it("works simultaneously with class filter and search filter", () => {
      // Month: Sep 2026 and Oct 2026
      // Class: Grade 10A
      const results = filterAssessments(mockAssessments, ["2026-09", "2026-10"], "Grade 10A");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Algebra Basics");

      // Add search query
      const searchResults = filterAssessments(
        mockAssessments,
        ["2026-09", "2026-10"],
        "Grade 10A",
        "Algebra"
      );
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe("Algebra Basics");

      const noMatchSearch = filterAssessments(
        mockAssessments,
        ["2026-09", "2026-10"],
        "Grade 10A",
        "Physics"
      );
      expect(noMatchSearch).toHaveLength(0);
    });

    it("verifies Total Assessments count matches the filtered assessment set", () => {
      const emptyMonthFilter = filterAssessments(mockAssessments, []);
      expect(emptyMonthFilter.length).toBe(4);

      const oneMonthFilter = filterAssessments(mockAssessments, ["2026-09"]);
      expect(oneMonthFilter.length).toBe(1);

      const multiMonthFilter = filterAssessments(mockAssessments, ["2026-09", "2026-10"]);
      expect(multiMonthFilter.length).toBe(2);
    });
  });
});

