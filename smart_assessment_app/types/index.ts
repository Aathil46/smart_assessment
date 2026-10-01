export type UserRole = "teacher" | "student";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export type ClassRecord = {
  id: string;
  teacherId: string;
  name: string;
  subject: string | null;
  grade: string | null;
  code: string;
  createdAt: string;
};

export type MaterialRecord = {
  id: string;
  classId: string;
  title: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  status: "uploaded" | "processing" | "processed" | "failed";
  error: string | null;
  processedAt: string | null;
  createdAt: string;
  extractedText: string | null;
  metadata?: {
    pageCount?: number;
    usedPages?: number;
    chunkCount?: number;
  };
};

export type MaterialSummaryConcept = {
  name: string;
  accuracy: number;
};

export type MaterialSummary = {
  title: string;
  topic: string;
  summary: string;
  concepts: MaterialSummaryConcept[];
};

export type Role = 'teacher' | 'student' | 'principal';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  title?: string;
  school?: string;
}

export interface School {
  id: string;
  name: string;
  district: string;
  studentCount: number;
  teacherCount: number;
  classCount: number;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  grade: string;
  joinCode: string;
  studentCount: number;
  teacherId: string;
  teacherName: string;
  assessmentCount: number;
  avgPerformance: number;
  color: string;
  createdAt: string;
}

export interface Material {
  id: string;
  classId: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: 'pdf' | 'doc' | 'docx' | 'txt' | 'ppt' | 'image';
  status: 'processing' | 'extracting' | 'ready' | 'error';
  progress?: number;
  extractedConcepts: string[];
  uploadedAt: string;
  pageCount?: number;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface Assessment {
  id: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  materialId?: string;
  materialTitle?: string;
  status: 'draft' | 'published' | 'closed';
  questionCount: number;
  duration: number;
  passingScore: number;
  publishedAt?: string;
  dueDate?: string;
  participation: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  avgScore: number;
  passRate: number;
  concepts: string[];
  questions: Question[];
}

export interface ConceptResult {
  concept: string;
  score: number;
  mastery: 'strong' | 'medium' | 'weak';
  correctCount: number;
  totalCount: number;
}

export interface StudentResult {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  score: number;
  passed: boolean;
  status: 'not-started' | 'in-progress' | 'completed' | 'graded';
  startedAt?: string;
  submittedAt?: string;
  timeSpent?: number;
  concepts: ConceptResult[];
  learningGaps: string[];
}

export interface TeachingInsight {
  id: string;
  classId: string;
  className: string;
  type: 'concept-gap' | 'student-support' | 'teaching-strategy' | 'positive';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  affectedStudents?: string[];
  concept?: string;
}

export interface PrincipalInsight {
  id: string;
  type: 'school-wide' | 'class-comparison' | 'teacher-performance' | 'student-risk';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  metric?: { label: string; value: string };
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar: string;
  classCount: number;
  studentCount: number;
  assessmentCount: number;
  avgPerformance: number;
  passRate: number;
  classes: { id: string; name: string; avgPerformance: number; studentCount: number }[];
}

export interface Notification {
  id: string;
  type: 'assessment' | 'class' | 'result' | 'insight' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}
