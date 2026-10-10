import { z } from "zod";

export const classSchema = z.object({
  name: z.string().trim().min(2, "Class name must be at least 2 characters."),
  subject: z.string().trim().min(1, "Subject is required.").optional().or(z.literal("")),
  grade: z.string().trim().min(1, "Grade is required.").optional().or(z.literal("")),
});

export const authSignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please provide a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["teacher", "student"]),
});

export const authLoginSchema = z.object({
  email: z.string().email("Please provide a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const ALLOWED_MATERIAL_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"] as const;
export type AllowedMaterialExtension = (typeof ALLOWED_MATERIAL_EXTENSIONS)[number];

export const ALLOWED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "application/msword",
  "application/vnd.ms-word",
  "application/x-msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
] as const;

export function isAllowedMaterialFile(fileName: string, mimeType: string): boolean {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = fileName.slice(dotIndex).toLowerCase();
  const validExt = (ALLOWED_MATERIAL_EXTENSIONS as readonly string[]).includes(ext);
  if (!validExt) return false;

  if (ext === ".pdf") return mimeType === "application/pdf" || mimeType === "application/octet-stream";
  if (ext === ".png") return mimeType === "image/png" || mimeType === "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") {
    return (
      ["image/jpeg", "image/jpg", "image/pjpeg", "application/octet-stream"].includes(mimeType)
    );
  }
  if (ext === ".doc") {
    return (
      [
        "application/msword",
        "application/vnd.ms-word",
        "application/x-msword",
        "application/octet-stream",
        "application/doc",
      ].includes(mimeType) || mimeType.includes("word")
    );
  }
  if (ext === ".docx") {
    return (
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
      ].includes(mimeType) ||
      mimeType.includes("word") ||
      mimeType.includes("officedocument")
    );
  }

  return false;
}

export const materialSchema = z.object({
  classId: z.string().min(1, "Class is required."),
  title: z.string().trim().min(2, "Title is required."),
  fileName: z.string().min(1, "File name is required."),
  mimeType: z.string().min(1, "File type is required."),
  size: z.number().positive("File must not be empty."),
});

export const aiConceptSchema = z.object({
  name: z.string().min(1),
  accuracy: z.number().min(0).max(1),
});

export const aiMaterialSummarySchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  summary: z.string().min(1),
  extractedText: z.string().optional(),
  concepts: z.array(aiConceptSchema).min(1),
});

export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const assessmentSchema = z.object({
  classId: z.string().uuid(),
  materialId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required."),
  topic: z.string().trim().optional(),
  numQuestions: z.coerce.number().int().min(3).max(20).default(10),
  difficulty: difficultySchema.default("medium"),
  opensAt: z.string().nullable().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid start date & time.",
  }),
  closesAt: z.string().nullable().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid end date & time.",
  }),
}).superRefine((value, context) => {
  if (value.opensAt && value.closesAt && new Date(value.closesAt) <= new Date(value.opensAt)) {
    context.addIssue({ code: "custom", path: ["closesAt"], message: "End time must be after start time." });
  }
});

export const questionSchema = z.object({
  assessmentId: z.string().uuid(),
  text: z.string().trim().min(1),
  choices: z.array(z.string().trim().min(1)).length(4),
  correctAnswer: z.string().trim().min(1),
  concept: z.string().trim().min(1),
  difficulty: difficultySchema,
  source: z.enum(["ai", "manual"]).optional(),
}).superRefine((value, context) => {
  if (new Set(value.choices).size !== value.choices.length) {
    context.addIssue({ code: "custom", path: ["choices"], message: "Choices must be unique." });
  }
  if (!value.choices.includes(value.correctAnswer)) {
    context.addIssue({ code: "custom", path: ["correctAnswer"], message: "Correct answer must match a choice." });
  }
});

export const publishSchema = z.object({
  opensAt: z.string().nullable().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid open date & time.",
  }),
  closesAt: z.string().nullable().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid close date & time.",
  }),
  attemptLimit: z.coerce.number().int().min(1).max(10).default(1),
}).superRefine((value, context) => {
  if (value.opensAt && value.closesAt && new Date(value.closesAt) <= new Date(value.opensAt)) {
    context.addIssue({ code: "custom", path: ["closesAt"], message: "Close time must be after open time." });
  }
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedChoice: z.string().trim().min(1),
});

export const joinClassSchema = z.object({
  code: z.string().trim().toUpperCase().length(6),
});

export type ClassInput = z.infer<typeof classSchema>;
export type AuthSignupInput = z.infer<typeof authSignupSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type MaterialInput = z.infer<typeof materialSchema>;
export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
