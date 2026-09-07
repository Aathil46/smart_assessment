import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/attempts/[id]/submit/route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/gemini/gaps", () => ({
  explainGap: vi.fn().mockResolvedValue(null),
}));

const { createServerSupabaseClient } = await import("@/lib/supabase/server");
const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");

function query(data: unknown, error: unknown = null) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data, error })),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  };
  return builder;
}

describe("student attempt submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists concept performance for a submitted assessment", async () => {
    const conceptPerfRows: any[] = [];
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "attempts") {
          const builder = query({
            id: "attempt-1",
            assessment_id: "assessment-1",
            student_id: "student-1",
            submitted_at: null,
          });
          builder.upsert = undefined;
          return builder;
        }
        if (table === "questions") {
          return query([{ id: "question-1", correct_answer: "A", concept: "Matter" }]);
        }
        if (table === "answers") {
          const builder = query([{ question_id: "question-1", selected_choice: "A" }]);
          builder.update = vi.fn(() => query(null));
          return builder;
        }
        if (table === "concept_perf") {
          const builder = query(null);
          builder.upsert = vi.fn((rows: any[]) => {
            conceptPerfRows.push(...rows);
            return Promise.resolve({ data: rows, error: null });
          });
          return builder;
        }
        if (table === "learning_gaps") return query(null);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "student-1" } } }) },
    } as any);
    vi.mocked(createAdminSupabaseClient).mockReturnValue(admin as any);

    const response = await POST(
      new Request("http://localhost/api/attempts/attempt-1/submit", { method: "POST" }),
      { params: Promise.resolve({ id: "attempt-1" }) },
    );

    expect(response.status).toBe(200);
    expect(conceptPerfRows).toEqual([
      {
        attempt_id: "attempt-1",
        concept: "Matter",
        correct_count: 1,
        total_count: 1,
        accuracy: 1,
        level: "Strong",
      },
    ]);
  });
});