import { describe, expect, it, vi, beforeEach } from "vitest";

// Aggregation logic mirrors TeacherDashboard logic
export function aggregateTrendPoints(
  rawPoints: {
    assessmentId: string;
    classId: string;
    title: string;
    className: string;
    date: string;
    fullDate: string;
    avgScore: number;
    submissionsCount: number;
  }[],
  selectedClassId: string,
  timeframe: "weekly" | "monthly",
  classes: { id: string; name: string }[] = []
) {
  // 1. Filter by class
  const filtered =
    !selectedClassId || selectedClassId === "all"
      ? rawPoints
      : rawPoints.filter((p) => p.classId === selectedClassId);

  if (filtered.length === 0) return [];

  // 2. Group by timeframe
  const groups = new Map<
    string,
    {
      key: string;
      sortTime: number;
      label: string;
      periodLabel: string;
      totalWeightedScore: number;
      totalSubmissions: number;
      assessmentsCount: number;
      totalScoreSum: number;
    }
  >();

  for (const p of filtered) {
    const d = new Date(p.fullDate || p.date);
    if (isNaN(d.getTime())) continue;

    let groupKey: string;
    let sortTime: number;
    let label: string;
    let periodLabel: string;

    if (timeframe === "weekly") {
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

      groupKey = `${monday.getFullYear()}-W${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      sortTime = monday.getTime();

      const startStr = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endStr = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      label = startStr;
      periodLabel = `Week of ${startStr} – ${endStr}`;
    } else {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      groupKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      sortTime = monthStart.getTime();

      label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      periodLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        sortTime,
        label,
        periodLabel,
        totalWeightedScore: 0,
        totalSubmissions: 0,
        assessmentsCount: 0,
        totalScoreSum: 0,
      });
    }

    const g = groups.get(groupKey)!;
    const subs = p.submissionsCount > 0 ? p.submissionsCount : 1;
    g.totalWeightedScore += p.avgScore * subs;
    g.totalSubmissions += subs;
    g.totalScoreSum += p.avgScore;
    g.assessmentsCount += 1;
  }

  const sorted = Array.from(groups.values()).sort((a, b) => a.sortTime - b.sortTime);
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const activeClassName = selectedClass ? selectedClass.name : "All Classes";

  return sorted.map((g) => {
    const avgScore =
      g.totalSubmissions > 0
        ? Math.round(g.totalWeightedScore / g.totalSubmissions)
        : Math.round(g.totalScoreSum / Math.max(g.assessmentsCount, 1));

    return {
      key: g.key,
      label: g.label,
      periodLabel: g.periodLabel,
      avgScore,
      submissionsCount: g.totalSubmissions,
      assessmentsCount: g.assessmentsCount,
      className: activeClassName,
    };
  });
}

describe("Performance Over Time Trend Aggregation", () => {
  const sampleClasses = [
    { id: "class-1", name: "Grade 10 - Mathematics" },
    { id: "class-2", name: "Grade 10 - Physics" },
  ];

  const samplePoints = [
    {
      assessmentId: "a1",
      classId: "class-1",
      title: "Algebra Quiz 1",
      className: "Grade 10 - Mathematics",
      date: "Sep 7",
      fullDate: "2026-09-07T10:00:00.000Z", // Monday of Week 1
      avgScore: 80,
      submissionsCount: 20,
    },
    {
      assessmentId: "a2",
      classId: "class-1",
      title: "Algebra Quiz 2",
      className: "Grade 10 - Mathematics",
      date: "Sep 9",
      fullDate: "2026-09-09T10:00:00.000Z", // Wednesday of Week 1
      avgScore: 90,
      submissionsCount: 10,
    },
    {
      assessmentId: "a3",
      classId: "class-1",
      title: "Geometry Test",
      className: "Grade 10 - Mathematics",
      date: "Sep 21",
      fullDate: "2026-09-21T10:00:00.000Z", // Week 3
      avgScore: 85,
      submissionsCount: 25,
    },
    {
      assessmentId: "a4",
      classId: "class-2",
      title: "Kinematics Test",
      className: "Grade 10 - Physics",
      date: "Sep 15",
      fullDate: "2026-09-15T10:00:00.000Z", // Week 2
      avgScore: 70,
      submissionsCount: 15,
    },
    {
      assessmentId: "a5",
      classId: "class-1",
      title: "Trigonometry Midterm",
      className: "Grade 10 - Mathematics",
      date: "Oct 12",
      fullDate: "2026-10-12T10:00:00.000Z", // October
      avgScore: 92,
      submissionsCount: 30,
    },
  ];

  it("filters assessments strictly by selected class", () => {
    const class1Weekly = aggregateTrendPoints(samplePoints, "class-1", "weekly", sampleClasses);
    expect(class1Weekly.length).toBe(3); // Week of Sep 7, Week of Sep 21, Week of Oct 12
    expect(class1Weekly.every((p) => p.className === "Grade 10 - Mathematics")).toBe(true);

    const class2Weekly = aggregateTrendPoints(samplePoints, "class-2", "weekly", sampleClasses);
    expect(class2Weekly.length).toBe(1);
    expect(class2Weekly[0].className === "Grade 10 - Physics").toBe(true);
    expect(class2Weekly[0].avgScore).toBe(70);
  });

  it("aggregates multiple assessments within the same calendar week using weighted average", () => {
    // a1: avg 80 with 20 subs, a2: avg 90 with 10 subs
    // weighted sum = (80*20 + 90*10) / (20 + 10) = (1600 + 900) / 30 = 2500 / 30 = 83.33 -> 83
    const class1Weekly = aggregateTrendPoints(samplePoints, "class-1", "weekly", sampleClasses);
    const firstWeek = class1Weekly[0];

    expect(firstWeek.avgScore).toBe(83);
    expect(firstWeek.submissionsCount).toBe(30);
    expect(firstWeek.assessmentsCount).toBe(2);
    expect(firstWeek.periodLabel).toContain("Week of");
  });

  it("orders aggregated periods chronologically and does not invent missing weeks", () => {
    const class1Weekly = aggregateTrendPoints(samplePoints, "class-1", "weekly", sampleClasses);
    // Sep 7 (Week 1), Sep 21 (Week 3), Oct 12 (Week 6) -> Exactly 3 periods
    expect(class1Weekly.length).toBe(3);
    // Chronological order verification
    expect(class1Weekly[0].avgScore).toBe(83);
    expect(class1Weekly[1].avgScore).toBe(85);
    expect(class1Weekly[2].avgScore).toBe(92);
  });

  it("aggregates by monthly calendar periods with accurate month labels", () => {
    const class1Monthly = aggregateTrendPoints(samplePoints, "class-1", "monthly", sampleClasses);
    // In Sep: a1 (80*20) + a2 (90*10) + a3 (85*25) = (1600 + 900 + 2125) / 55 = 4625 / 55 = 84.09 -> 84
    // In Oct: a5 (92*30) / 30 = 92
    expect(class1Monthly.length).toBe(2);
    expect(class1Monthly[0].periodLabel).toContain("September 2026");
    expect(class1Monthly[0].avgScore).toBe(84);
    expect(class1Monthly[0].submissionsCount).toBe(55);
    expect(class1Monthly[0].assessmentsCount).toBe(3);

    expect(class1Monthly[1].periodLabel).toContain("October 2026");
    expect(class1Monthly[1].avgScore).toBe(92);
    expect(class1Monthly[1].submissionsCount).toBe(30);
  });

  it("handles classes with no assessments gracefully", () => {
    const emptyResult = aggregateTrendPoints(samplePoints, "non-existent-class", "weekly", sampleClasses);
    expect(emptyResult).toEqual([]);
  });

  it("supports 'all' classes aggregation option", () => {
    const allMonthly = aggregateTrendPoints(samplePoints, "all", "monthly", sampleClasses);
    expect(allMonthly.length).toBe(2);
    // September includes a1, a2, a3, and a4 from both classes
    expect(allMonthly[0].assessmentsCount).toBe(4);
    expect(allMonthly[0].submissionsCount).toBe(70);
  });
});

describe("Continuous Bell Ringing & Unread Badge Rules", () => {
  it("determines continuous ringing animation class based on unread count", () => {
    const getBellAnimationClass = (unreadCount: number) => {
      return unreadCount > 0 ? "animate-bell-ring-continuous" : "";
    };

    expect(getBellAnimationClass(5)).toBe("animate-bell-ring-continuous");
    expect(getBellAnimationClass(1)).toBe("animate-bell-ring-continuous");
    expect(getBellAnimationClass(0)).toBe("");
  });

  it("determines unread indicator visibility based on unread count", () => {
    const shouldShowUnreadIndicator = (unreadCount: number) => {
      return unreadCount > 0;
    };

    expect(shouldShowUnreadIndicator(3)).toBe(true);
    expect(shouldShowUnreadIndicator(1)).toBe(true);
    expect(shouldShowUnreadIndicator(0)).toBe(false);
  });
});
