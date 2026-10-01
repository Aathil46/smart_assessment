export interface TeacherClassCard {
  id: string;
  name: string;
  subject: string;
  grade: string;
  joinCode: string;
  studentCount: number | "-";
  assessmentCount: number | "-";
  avgPerformance: number | null;
  color: string;
  createdAt: string;
}
