/**
 * Scheduling and deadline calculation utilities for Smart Assessment.
 */

export interface ScheduleValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate schedule start and end timestamps.
 */
export function validateSchedule(
  startDate?: string | null,
  endDate?: string | null
): ScheduleValidationResult {
  if (!startDate && !endDate) {
    return { valid: true };
  }

  const startMs = startDate ? new Date(startDate).getTime() : null;
  const endMs = endDate ? new Date(endDate).getTime() : null;

  if (startMs !== null && isNaN(startMs)) {
    return {
      valid: false,
      error: "Please provide a valid start date and time.",
    };
  }

  if (endMs !== null && isNaN(endMs)) {
    return {
      valid: false,
      error: "Please provide a valid end date and time.",
    };
  }

  if (startMs !== null && endMs !== null && endMs <= startMs) {
    return {
      valid: false,
      error: "End time must be after start time.",
    };
  }

  return { valid: true };
}

/**
 * Calculate the effective deadline for an attempt.
 * Rule: For students who started on time, the effective deadline is the
 * earlier of (attempt started_at + assessment duration) or (scheduled end time).
 * If no scheduled end time is set, the duration limit applies.
 */
export function calculateEffectiveDeadline(
  startedAt: string | Date | null | undefined,
  durationMinutes: number,
  closesAt?: string | Date | null
): number {
  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const safeStartMs = isNaN(startMs) ? Date.now() : startMs;
  const safeDurationMinutes = Math.max(1, durationMinutes || 45);
  const durationDeadline = safeStartMs + safeDurationMinutes * 60 * 1000;

  if (!closesAt) {
    return durationDeadline;
  }

  const closesMs = new Date(closesAt).getTime();
  if (isNaN(closesMs)) {
    return durationDeadline;
  }

  return Math.min(durationDeadline, closesMs);
}

/**
 * Check if the current time is before the assessment's scheduled start time.
 */
export function isBeforeSchedule(
  opensAt?: string | Date | null,
  nowMs: number = Date.now()
): boolean {
  if (!opensAt) return false;
  const openMs = new Date(opensAt).getTime();
  if (isNaN(openMs)) return false;
  return nowMs < openMs;
}

/**
 * Check if the current time is after the assessment's scheduled end time.
 */
export function isAfterSchedule(
  closesAt?: string | Date | null,
  nowMs: number = Date.now()
): boolean {
  if (!closesAt) return false;
  const closeMs = new Date(closesAt).getTime();
  if (isNaN(closeMs)) return false;
  return nowMs >= closeMs;
}

/**
 * Format remaining milliseconds into human-readable countdown string.
 * Formats: "HH:MM:SS" or "MM:SS".
 */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
