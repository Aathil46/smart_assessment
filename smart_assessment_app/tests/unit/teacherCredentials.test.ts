import { describe, expect, it, vi, beforeEach } from "vitest";
import { maskApiKey, getTeacherGeminiApiKey } from "@/lib/gemini/teacher-credentials";

// Mock createAdminSupabaseClient
vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminSupabaseClient: vi.fn(),
  };
});

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

describe("Teacher Gemini Credentials Helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "platform-fallback-key-12345";
  });

  describe("maskApiKey", () => {
    it("masks a standard Gemini API key showing prefix and suffix", () => {
      const key = "AIzaSyB_1234567890abcdefXYZ";
      const masked = maskApiKey(key);
      expect(masked).toBe("AIza••••••••fXYZ");
      expect(masked).not.toContain("1234567890abcdef");
    });

    it("handles short or empty keys safely without throwing", () => {
      expect(maskApiKey("")).toBe("");
      expect(maskApiKey(null)).toBe("");
      expect(maskApiKey(undefined)).toBe("");
      expect(maskApiKey("short")).toBe("••••••••");
    });
  });

  describe("getTeacherGeminiApiKey fallback logic", () => {
    it("returns the teacher's personal key when configured in profile", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { gemini_api_key: "AIzaSyCustomTeacherKey999" },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminSupabaseClient as any).mockReturnValue({
        from: mockFrom,
      });

      const key = await getTeacherGeminiApiKey("teacher-uuid-1");
      expect(key).toBe("AIzaSyCustomTeacherKey999");
      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockSelect).toHaveBeenCalledWith("gemini_api_key");
      expect(mockEq).toHaveBeenCalledWith("id", "teacher-uuid-1");
    });

    it("falls back to platform process.env.GEMINI_API_KEY when teacher has no personal key", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { gemini_api_key: null },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminSupabaseClient as any).mockReturnValue({
        from: mockFrom,
      });

      const key = await getTeacherGeminiApiKey("teacher-uuid-2");
      expect(key).toBe("platform-fallback-key-12345");
    });

    it("falls back to platform key if database query fails or teacherId is empty", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB connection timeout" },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      (createAdminSupabaseClient as any).mockReturnValue({
        from: mockFrom,
      });

      const key = await getTeacherGeminiApiKey("teacher-uuid-3");
      expect(key).toBe("platform-fallback-key-12345");

      const emptyKey = await getTeacherGeminiApiKey("");
      expect(emptyKey).toBe("platform-fallback-key-12345");
    });
  });
});
