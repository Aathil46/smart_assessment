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
