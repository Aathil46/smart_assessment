import { describe, expect, it } from "vitest";
import {
  calculateEffectiveDeadline,
  validateSchedule,
  isBeforeSchedule,
  isAfterSchedule,
  formatCountdown,
} from "@/lib/scheduling";
import { assessmentSchema, publishSchema } from "@/lib/validation";

describe("Scheduled Assessments - Unit Tests", () => {
  describe("validateSchedule", () => {
    it("accepts unscheduled configurations (both undefined or empty)", () => {
      expect(validateSchedule(undefined, undefined)).toEqual({ valid: true });
      expect(validateSchedule(null, null)).toEqual({ valid: true });
      expect(validateSchedule("", "")).toEqual({ valid: true });
    });

    it("accepts valid start and end dates where end is after start", () => {
      const start = "2026-10-10T09:00:00Z";
      const end = "2026-10-10T11:00:00Z";
      expect(validateSchedule(start, end)).toEqual({ valid: true });
    });

    it("rejects end time that is before start time", () => {
      const start = "2026-10-10T11:00:00Z";
      const end = "2026-10-10T09:00:00Z";
      const result = validateSchedule(start, end);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("End time must be after start time");
    });

    it("rejects end time that equals start time", () => {
      const time = "2026-10-10T09:00:00Z";
      const result = validateSchedule(time, time);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("End time must be after start time");
    });

    it("rejects invalid date strings", () => {
      expect(validateSchedule("not-a-date", "2026-10-10T09:00:00Z").valid).toBe(false);
      expect(validateSchedule("2026-10-10T09:00:00Z", "not-a-date").valid).toBe(false);
    });

    it("accepts schedule with only start date or only end date", () => {
      expect(validateSchedule("2026-10-10T09:00:00Z", undefined)).toEqual({ valid: true });
      expect(validateSchedule(undefined, "2026-10-10T11:00:00Z")).toEqual({ valid: true });
    });
  });

  describe("calculateEffectiveDeadline", () => {
    const startedAt = "2026-10-10T10:00:00.000Z";
    const startTimeMs = new Date(startedAt).getTime();
    const durationMinutes = 30; // 30 minutes = 1,800,000 ms

    it("calculates deadline as started_at + duration for unscheduled assessments", () => {
      const deadline = calculateEffectiveDeadline(startedAt, durationMinutes, null);
      expect(deadline).toBe(startTimeMs + 30 * 60 * 1000);
    });

    it("calculates deadline as started_at + duration when closes_at is later than duration end", () => {
      // Closes 2 hours after start (12:00:00Z), duration is 30 mins (ends 10:30:00Z)
      const closesAt = "2026-10-10T12:00:00.000Z";
      const deadline = calculateEffectiveDeadline(startedAt, durationMinutes, closesAt);
      expect(deadline).toBe(startTimeMs + 30 * 60 * 1000);
    });

    it("calculates deadline as closes_at when closes_at is earlier than started_at + duration", () => {
      // Closes 15 mins after start (10:15:00Z), duration is 30 mins (would end 10:30:00Z)
      const closesAt = "2026-10-10T10:15:00.000Z";
      const closesTimeMs = new Date(closesAt).getTime();
      const deadline = calculateEffectiveDeadline(startedAt, durationMinutes, closesAt);
      expect(deadline).toBe(closesTimeMs);
    });

    it("handles students who started on time finishing even after scheduled end if closes_at permits", () => {
      // If assessment does not specify a closes_at (only opens_at was configured)
      const deadline = calculateEffectiveDeadline(startedAt, 45, null);
      expect(deadline).toBe(startTimeMs + 45 * 60 * 1000);
    });

    it("maintains deterministic deadline on reconnect/refresh", () => {
      // Multiple calculations simulating tab reload at different moments
      const deadline1 = calculateEffectiveDeadline(startedAt, durationMinutes, "2026-10-10T11:00:00.000Z");
      const deadline2 = calculateEffectiveDeadline(startedAt, durationMinutes, "2026-10-10T11:00:00.000Z");
      expect(deadline1).toBe(deadline2);
    });
  });

  describe("isBeforeSchedule and isAfterSchedule", () => {
    const opensAt = "2026-10-10T10:00:00.000Z";
    const closesAt = "2026-10-10T12:00:00.000Z";
    const opensMs = new Date(opensAt).getTime();
    const closesMs = new Date(closesAt).getTime();

    it("correctly identifies early access attempts before opens_at", () => {
      expect(isBeforeSchedule(opensAt, opensMs - 10000)).toBe(true);
      expect(isBeforeSchedule(opensAt, opensMs)).toBe(false);
      expect(isBeforeSchedule(opensAt, opensMs + 10000)).toBe(false);
      expect(isBeforeSchedule(null, opensMs - 10000)).toBe(false);
    });

    it("correctly identifies late access attempts after closes_at", () => {
      expect(isAfterSchedule(closesAt, closesMs + 10000)).toBe(true);
      expect(isAfterSchedule(closesAt, closesMs)).toBe(true);
      expect(isAfterSchedule(closesAt, closesMs - 10000)).toBe(false);
      expect(isAfterSchedule(null, closesMs + 10000)).toBe(false);
    });
  });

  describe("formatCountdown", () => {
    it("formats hours, minutes, and seconds properly", () => {
      const ms = (2 * 3600 + 15 * 60 + 42) * 1000;
      expect(formatCountdown(ms)).toBe("2:15:42");
    });

    it("formats minutes and seconds when under 1 hour", () => {
      const ms = (5 * 60 + 30) * 1000;
      expect(formatCountdown(ms)).toBe("05:30");
    });

    it("formats zero and negative durations gracefully", () => {
      expect(formatCountdown(0)).toBe("00:00");
      expect(formatCountdown(-5000)).toBe("00:00");
    });
  });

  describe("Zod validation schemas with schedule fields", () => {
    const validAssessmentBase = {
      classId: "00000000-0000-4000-8000-000000000001",
      materialId: "00000000-0000-4000-8000-000000000002",
      title: "Algebra Exam",
      topic: "Quadratics",
      numQuestions: 10,
      difficulty: "medium" as const,
    };

    it("accepts assessment without scheduling fields", () => {
      const parsed = assessmentSchema.parse(validAssessmentBase);
      expect(parsed.opensAt).toBeUndefined();
      expect(parsed.closesAt).toBeUndefined();
    });

    it("accepts assessment with valid scheduling timestamps", () => {
      const parsed = assessmentSchema.parse({
        ...validAssessmentBase,
        opensAt: "2026-10-10T09:00:00Z",
        closesAt: "2026-10-10T11:00:00Z",
      });
      expect(parsed.opensAt).toBe("2026-10-10T09:00:00Z");
      expect(parsed.closesAt).toBe("2026-10-10T11:00:00Z");
    });

    it("rejects assessment where closesAt is before opensAt", () => {
      expect(() =>
        assessmentSchema.parse({
          ...validAssessmentBase,
          opensAt: "2026-10-10T11:00:00Z",
          closesAt: "2026-10-10T09:00:00Z",
        })
      ).toThrow();
    });

    it("accepts publishSchema with valid schedule and rejects invalid schedule", () => {
      expect(
        publishSchema.parse({
          opensAt: "2026-10-10T09:00:00Z",
          closesAt: "2026-10-10T11:00:00Z",
        })
      ).toMatchObject({
        opensAt: "2026-10-10T09:00:00Z",
        closesAt: "2026-10-10T11:00:00Z",
      });

      expect(() =>
        publishSchema.parse({
          opensAt: "2026-10-10T11:00:00Z",
          closesAt: "2026-10-10T09:00:00Z",
        })
      ).toThrow();
    });
  });
});
