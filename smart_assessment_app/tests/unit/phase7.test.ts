import { describe, expect, it } from "vitest";
import { aggregateClassPerformance } from "@/lib/analytics";
import { generateExcelReport } from "@/lib/excelExport";
import ExcelJS from "exceljs";

describe("Phase 7 — Student Filtering, Sorting & Excel Export", () => {
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
    // s1: Score 7/10 (70% - Pass), but has 1 Weak concept (s1 is a Weak Student)
    { id: "a1", student_id: "s1", score: 7, total: 10, started_at: "2024-01-01T10:00:00Z", submitted_at: "2024-01-01T10:30:00Z" },
    // s2: Score 4/10 (40% - Fail), but no Weak concept (all Medium)
    { id: "a2", student_id: "s2", score: 4, total: 10, started_at: "2024-01-01T11:00:00Z", submitted_at: "2024-01-01T11:30:00Z" },
    // s3: In Progress
    { id: "a3", student_id: "s3", score: null, total: null, started_at: "2024-01-01T12:00:00Z", submitted_at: null },
    // s4: Not Started
  ];

  const conceptPerfs = [
    // s1 perfs
    { attempt_id: "a1", concept: "Photosynthesis", correct_count: 5, total_count: 5, accuracy: 1.0, level: "Strong" },
    { attempt_id: "a1", concept: "Light Reactions", correct_count: 2, total_count: 5, accuracy: 0.4, level: "Weak" }, // Weak!

    // s2 perfs
    { attempt_id: "a2", concept: "Photosynthesis", correct_count: 3, total_count: 5, accuracy: 0.6, level: "Medium" },
    { attempt_id: "a2", concept: "Light Reactions", correct_count: 3, total_count: 5, accuracy: 0.6, level: "Medium" },
  ];

  it("applies the exact V3 Weak Student filter rules", () => {
    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);
    
    const sr1 = result.studentResults.find((s) => s.student_id === "s1");
    const sr2 = result.studentResults.find((s) => s.student_id === "s2");

    // s1 has overall 70% (Pass) but 1 Weak concept -> isWeakStudent MUST be true
    expect(sr1?.percentage).toBe(70);
    expect(sr1?.passFail).toBe("Pass");
    expect(sr1?.isWeakStudent).toBe(true);

    // s2 has overall 40% (Fail) but NO Weak concept -> isWeakStudent MUST be false
    expect(sr2?.percentage).toBe(40);
    expect(sr2?.passFail).toBe("Fail");
    expect(sr2?.isWeakStudent).toBe(false);
  });

  it("filters students into correct categories (Completed, In Progress, Failed, Weak)", () => {
    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);
    const students = result.studentResults;

    const completed = students.filter((s) => s.status === "Completed");
    const inProgress = students.filter((s) => s.status === "In Progress");
    const failed = students.filter((s) => s.status === "Completed" && s.passFail === "Fail");
    const weak = students.filter((s) => s.isWeakStudent);

    expect(completed.map((s) => s.student_id)).toEqual(["s1", "s2"]);
    expect(inProgress.map((s) => s.student_id)).toEqual(["s3"]);
    expect(failed.map((s) => s.student_id)).toEqual(["s2"]);
    expect(weak.map((s) => s.student_id)).toEqual(["s1"]);
  });

  it("sorts by most recent submission timestamp", () => {
    const result = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);
    const completed = result.studentResults.filter((s) => s.status === "Completed");

    // s2 submitted at 11:30, s1 submitted at 10:30
    completed.sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime());

    expect(completed[0].name).toBe("Bala");
    expect(completed[1].name).toBe("Aathil");
  });

  it("generates an authentic Excel buffer preserving In Progress status and concept levels", async () => {
    const performanceResult = aggregateClassPerformance(members, profiles, attempts, conceptPerfs);

    const buffer = await generateExcelReport({
      assessmentTitle: "Photosynthesis Test",
      className: "Biology 101",
      performanceResult,
      conceptPerfs,
      attempts,
    });

    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(100);

    // Read back generated workbook with ExcelJS to verify structure
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(buffer) as any);

    const sheet = workbook.getWorksheet("Class Results");
    expect(sheet).toBeDefined();

    // Verify Headers
    const headerRow = sheet!.getRow(1);
    const headers = headerRow.values as string[];
    expect(headers).toContain("Student");
    expect(headers).toContain("Score");
    expect(headers).toContain("Percentage");
    expect(headers).toContain("Status");
    expect(headers).toContain("Weak Student");
    expect(headers).toContain("Light Reactions");
    expect(headers).toContain("Photosynthesis");

    // Verify row data for s1 (Completed, Weak)
    const rowS1 = sheet!.getRows(2, sheet!.rowCount)!.find((r) => r.getCell(1).value === "Aathil");
    expect(rowS1).toBeDefined();
    expect(rowS1!.getCell(2).value).toBe("7 / 10");
    expect(rowS1!.getCell(3).value).toBe("70%");
    expect(rowS1!.getCell(4).value).toBe("Completed");
    expect(rowS1!.getCell(6).value).toBe("Yes"); // Weak Student

    // Verify row data for s3 (In Progress - score should be "—")
    const rowS3 = sheet!.getRows(2, sheet!.rowCount)!.find((r) => r.getCell(1).value === "Celine");
    expect(rowS3).toBeDefined();
    expect(rowS3!.getCell(2).value).toBe("—");
    expect(rowS3!.getCell(4).value).toBe("In Progress");
    expect(rowS3!.getCell(6).value).toBe("—");
  });
});
