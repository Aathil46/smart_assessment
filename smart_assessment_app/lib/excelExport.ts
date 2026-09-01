import ExcelJS from "exceljs";
import { type ClassPerformanceResult, type ConceptPerfData, type AttemptData } from "./analytics";

export type ExcelExportInput = {
  assessmentTitle: string;
  className: string;
  performanceResult: ClassPerformanceResult;
  conceptPerfs: ConceptPerfData[];
  attempts: AttemptData[];
};

export async function generateExcelReport({
  assessmentTitle,
  className,
  performanceResult,
  conceptPerfs,
  attempts,
}: ExcelExportInput): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Smart Assessment System";
  workbook.lastModifiedBy = "AI Smart Assessment System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Class Results");

  // Collect all unique concept names across completed attempts
  const allConcepts = Array.from(new Set(conceptPerfs.map((cp) => cp.concept))).sort();

  // Define static columns + dynamic concept columns
  const columns = [
    { header: "Student", key: "student", width: 25 },
    { header: "Score", key: "score", width: 12 },
    { header: "Percentage", key: "percentage", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Pass / Fail", key: "passFail", width: 15 },
    { header: "Weak Student", key: "weakStudent", width: 15 },
    ...allConcepts.map((concept) => ({
      header: concept,
      key: `concept_${concept}`,
      width: 20,
    })),
  ];

  worksheet.columns = columns;

  // Map attempt_id to performance records
  const perfByAttempt = new Map<string, Map<string, ConceptPerfData>>();
  for (const cp of conceptPerfs) {
    let map = perfByAttempt.get(cp.attempt_id);
    if (!map) {
      map = new Map<string, ConceptPerfData>();
      perfByAttempt.set(cp.attempt_id, map);
    }
    map.set(cp.concept, cp);
  }

  // Populate rows for every enrolled student
  for (const student of performanceResult.studentResults) {
    const rowData: Record<string, string> = {
      student: student.name,
      score: student.status === "Completed" && student.score !== null && student.total !== null ? `${student.score} / ${student.total}` : "—",
      percentage: student.status === "Completed" && student.percentage !== null ? `${student.percentage}%` : "—",
      status: student.status,
      passFail: student.status === "Completed" && student.passFail ? student.passFail : "—",
      weakStudent: student.status === "Completed" ? (student.isWeakStudent ? "Yes" : "No") : "—",
    };

    // Add concept columns for this student if completed
    if (student.status === "Completed" && student.attempt_id) {
      const studentConcepts = perfByAttempt.get(student.attempt_id);
      for (const concept of allConcepts) {
        const cp = studentConcepts?.get(concept);
        if (cp) {
          const percentageStr = `${Number((cp.accuracy * 100).toFixed(2))}%`;
          rowData[`concept_${concept}`] = `${percentageStr} — ${cp.level}`;
        } else {
          rowData[`concept_${concept}`] = "—";
        }
      }
    } else {
      for (const concept of allConcepts) {
        rowData[`concept_${concept}`] = "—";
      }
    }

    worksheet.addRow(rowData);
  }

  // Styling header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // Blue-600
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}
