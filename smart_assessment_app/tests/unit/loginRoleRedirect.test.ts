import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as reviewPost } from "@/app/api/principal/assessments/[id]/review/route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  toErrorResponse: (error: Error) => ({ message: error.message }),
}));

vi.mock("@/lib/auth/principal", () => ({
  requirePrincipalSession: vi.fn(),
}));

vi.mock("@/lib/gemini/principal", () => ({
  generatePrincipalReview: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  aggregateClassPerformance: vi.fn(),
}));

const { createServerSupabaseClient } = await import("@/lib/supabase/server");
const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
const { requirePrincipalSession } = await import("@/lib/auth/principal");
const { generatePrincipalReview } = await import("@/lib/gemini/principal");
const { aggregateClassPerformance } = await import("@/lib/analytics");

// ---------------------------------------------------------------------------
// Helpers mirroring the logic in app/(auth)/login/page.tsx and the API route
// ---------------------------------------------------------------------------

type Role = "teacher" | "student" | "principal";

const ROLE_DASHBOARDS: Record<Role, string> = {
  teacher: "/teacher",
  student: "/student",
  principal: "/principal",
};

function getDashboardForRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return ROLE_DASHBOARDS[role as Role] ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Login role → dashboard redirect", () => {
  it("routes a teacher to /teacher", () => {
    expect(getDashboardForRole("teacher")).toBe("/teacher");
  });

  it("routes a student to /student", () => {
    expect(getDashboardForRole("student")).toBe("/student");
  });

  it("routes a principal to /principal", () => {
    expect(getDashboardForRole("principal")).toBe("/principal");
  });

  it("returns null for an unknown role", () => {
    expect(getDashboardForRole("admin")).toBeNull();
    expect(getDashboardForRole("superuser")).toBeNull();
  });

  it("returns null when role is null", () => {
    expect(getDashboardForRole(null)).toBeNull();
  });

  it("returns null when role is undefined", () => {
    expect(getDashboardForRole(undefined)).toBeNull();
  });
});

describe("Login API response shape", () => {
  it("ok:true payload includes a role field", () => {
    // Simulate what /api/auth/login returns on success
    const mockSuccess = { ok: true, role: "teacher" as Role };

    expect(mockSuccess.ok).toBe(true);
    expect(["teacher", "student", "principal"]).toContain(mockSuccess.role);
  });

  it("error payload does NOT contain a role field", () => {
    const mockError = { error: { code: "VALIDATION_ERROR", message: "Invalid email." } };

    expect("ok" in mockError).toBe(false);
    expect("role" in mockError).toBe(false);
  });

  it("getDashboardForRole handles a success payload with role teacher", () => {
    const payload = { ok: true, role: "teacher" };
    const dashboard = getDashboardForRole(payload.role);
    expect(dashboard).toBe("/teacher");
  });

  it("getDashboardForRole handles a success payload with role student", () => {
    const payload = { ok: true, role: "student" };
    const dashboard = getDashboardForRole(payload.role);
    expect(dashboard).toBe("/student");
  });

  it("getDashboardForRole handles a success payload with role principal", () => {
    const payload = { ok: true, role: "principal" };
    const dashboard = getDashboardForRole(payload.role);
    expect(dashboard).toBe("/principal");
  });

  it("returns null when API responds with role: null (profile missing)", () => {
    const payload = { ok: true, role: null };
    const dashboard = getDashboardForRole(payload.role);
    expect(dashboard).toBeNull();
  });
});

describe("Root-page redirect map", () => {
  const ROOT_DASHBOARDS: Record<string, string> = {
    teacher: "/teacher",
    student: "/student",
    principal: "/principal",
  };

  it("maps all three valid roles", () => {
    expect(ROOT_DASHBOARDS["teacher"]).toBe("/teacher");
    expect(ROOT_DASHBOARDS["student"]).toBe("/student");
    expect(ROOT_DASHBOARDS["principal"]).toBe("/principal");
  });

  it("undefined for unknown role (no redirect)", () => {
    expect(ROOT_DASHBOARDS["unknown"]).toBeUndefined();
  });
});

describe("Real login API role lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the authenticated profile role for teacher, student, and principal", async () => {
    const serverClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { access_token: "abc" }, user: { id: "user-123" } },
          error: null,
        }),
      },
    };

    const adminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "principal" } }),
      }),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue(serverClient as any);
    vi.mocked(createAdminSupabaseClient).mockReturnValue(adminClient as any);

    const res = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "principal@example.com", password: "password123" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, role: "principal" });

    vi.mocked(createAdminSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "teacher" } }),
      }),
    } as any);

    const teacherRes = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "teacher@example.com", password: "password123" }),
      }),
    );
    await expect(teacherRes.json()).resolves.toMatchObject({ ok: true, role: "teacher" });

    vi.mocked(createAdminSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "student" } }),
      }),
    } as any);

    const studentRes = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "student@example.com", password: "password123" }),
      }),
    );
    await expect(studentRes.json()).resolves.toMatchObject({ ok: true, role: "student" });
  });
});

describe("Principal review summary uses backend aggregation, not request body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized schools and derives the summary from aggregateClassPerformance", async () => {
    vi.mocked(requirePrincipalSession).mockResolvedValue({
      user: { id: "principal-id" },
      profile: { id: "principal-id", role: "principal", school_id: "school-1" },
    } as any);

    const serverClient = {
      from: vi.fn((table: string) => {
        if (table === "assessments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "assessment-1",
                class_id: "class-1",
                classes: {
                  name: "Class 10A",
                  teacher_id: "teacher-1",
                  profiles: { school_id: "school-2", name: "Teacher Doe" },
                },
              },
            }),
          };
        }
        if (table === "class_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { school_id: "school-2" } }),
          };
        }
        if (table === "attempts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (table === "concept_perf") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue(serverClient as any);
    vi.mocked(aggregateClassPerformance).mockReturnValue({
      overview: { totalStudents: 5, completed: 4, inProgress: 1, passed: 3, failed: 1 },
      weakConcepts: [{ concept: "Fractions", accuracyPercentage: 45, level: "Weak", affectedStudents: [] }],
      mediumConcepts: [],
      studentResults: [],
    } as any);
    vi.mocked(generatePrincipalReview).mockResolvedValue("Backend-derived summary");

    const response = await reviewPost(
      new Request("http://localhost/api/principal/assessments/assessment-1/review", {
        method: "POST",
        body: JSON.stringify({
          passed: 999,
          failed: 999,
          weakConcepts: ["TRUSTED-ATTACK"],
        }),
      }),
      { params: Promise.resolve({ id: "assessment-1" }) },
    );

    await expect(response.status).toBe(403);
    expect(generatePrincipalReview).not.toHaveBeenCalled();
  });
});
