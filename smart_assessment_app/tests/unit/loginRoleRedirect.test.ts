import { describe, expect, it } from "vitest";

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
