import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { GET as getNotifications } from "@/app/api/teacher/notifications/route";
import { POST as dismissNotification } from "@/app/api/teacher/notifications/dismiss/route";

describe("Teacher Notifications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/teacher/notifications", () => {
    it("returns 401 when unauthenticated", async () => {
      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) },
      });

      const res = await getNotifications();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("returns 403 when role is not teacher", async () => {
      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "student-1" } }, error: null }) },
      });

      (createAdminSupabaseClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "student-1", role: "student" }, error: null }),
            }),
          }),
        }),
      });

      const res = await getNotifications();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("generates notifications and filters out dismissed ones", async () => {
      const teacherId = "teacher-1";

      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId } }, error: null }) },
      });

      const mockFrom = vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: teacherId,
                    role: "teacher",
                    dismissed_notifications: ["notif-res-assessment-1"], // Dismissed results notification
                  },
                  error: null,
                }),
              })),
              in: vi.fn().mockResolvedValue({
                data: [{ id: "student-1", name: "Aashik", email: "aashik@test.com" }],
                error: null,
              }),
            })),
          };
        }

        if (table === "classes") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "class-1", name: "Grade 10 Math", subject: "Math", code: "MTH10" }],
                error: null,
              }),
            })),
          };
        }

        if (table === "assessments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "assessment-1",
                        title: "Algebra Exam",
                        class_id: "class-1",
                        status: "published",
                        closes_at: "2026-10-09T10:00:00Z",
                        created_at: "2026-10-09T08:00:00Z",
                        ai_insights: { summary: "Good progress" },
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "attempts") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "attempt-1",
                        assessment_id: "assessment-1",
                        student_id: "student-1",
                        score: 9,
                        total: 10,
                        submitted_at: "2026-10-09T09:30:00Z",
                        created_at: "2026-10-09T09:00:00Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "class_members") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "member-1",
                        class_id: "class-1",
                        student_id: "student-1",
                        joined_at: "2026-10-09T08:30:00Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      (createAdminSupabaseClient as any).mockReturnValue({ from: mockFrom });

      const res = await getNotifications();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.notifications)).toBe(true);

      const notifIds = json.notifications.map((n: any) => n.id);
      // "notif-res-assessment-1" was in dismissed_notifications and must be filtered out!
      expect(notifIds).not.toContain("notif-res-assessment-1");

      // Other active notifications should be present
      expect(notifIds).toContain("notif-sub-attempt-1");
      expect(notifIds).toContain("notif-ins-assessment-1");
      expect(notifIds).toContain("notif-join-member-1");

      const subNotif = json.notifications.find((n: any) => n.id === "notif-sub-attempt-1");
      expect(subNotif.type).toBe("student_submission");
      expect(subNotif.title).toContain("Aashik");
      expect(subNotif.actionUrl).toBe("/teacher/results/assessment-1");
    });
  });

  describe("POST /api/teacher/notifications/dismiss", () => {
    it("returns 401 when unauthenticated", async () => {
      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) },
      });

      const req = new Request("http://localhost/api/teacher/notifications/dismiss", {
        method: "POST",
        body: JSON.stringify({ notificationId: "notif-123" }),
      });

      const res = await dismissNotification(req);
      expect(res.status).toBe(401);
    });

    it("appends dismissed notification ID for the authenticated teacher", async () => {
      const teacherId = "teacher-1";

      (createServerSupabaseClient as any).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: teacherId } }, error: null }) },
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: teacherId,
                role: "teacher",
                dismissed_notifications: ["notif-old-1"],
              },
              error: null,
            }),
          })),
        })),
        update: mockUpdate,
      }));

      (createAdminSupabaseClient as any).mockReturnValue({ from: mockFrom });

      const req = new Request("http://localhost/api/teacher/notifications/dismiss", {
        method: "POST",
        body: JSON.stringify({ notificationId: "notif-new-2" }),
      });

      const res = await dismissNotification(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.dismissedId).toBe("notif-new-2");

      expect(mockUpdate).toHaveBeenCalledWith({
        dismissed_notifications: ["notif-old-1", "notif-new-2"],
      });
    });
  });
});
