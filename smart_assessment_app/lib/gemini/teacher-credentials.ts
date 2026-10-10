import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Mask an API key so that only a preview is visible, never the full key.
 * e.g. "AIzaSyAbcdef1234567890" -> "AIza••••••••7890"
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key || typeof key !== "string") return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Retrieves the Gemini API key for a teacher.
 * If the teacher has configured their own personal key, that key is returned.
 * Otherwise, falls back to the system/platform process.env.GEMINI_API_KEY.
 */
export async function getTeacherGeminiApiKey(teacherId: string): Promise<string | undefined> {
  if (!teacherId) return process.env.GEMINI_API_KEY;

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", teacherId)
      .single();

    if (!error && data?.gemini_api_key && typeof data.gemini_api_key === "string" && data.gemini_api_key.trim()) {
      return data.gemini_api_key.trim();
    }
  } catch (err) {
    console.warn("[TeacherCredentials] Failed to load personal key for teacher:", teacherId, err);
  }

  return process.env.GEMINI_API_KEY;
}

/**
 * Saves a personal Gemini API key for a teacher.
 */
export async function saveTeacherGeminiApiKey(teacherId: string, apiKey: string): Promise<void> {
  if (!teacherId) throw new Error("Teacher ID is required.");
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key cannot be empty.");

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("profiles")
    .update({ gemini_api_key: trimmed })
    .eq("id", teacherId);

  if (error) {
    throw new Error(`Failed to save Gemini API key: ${error.message}`);
  }
}

/**
 * Removes the personal Gemini API key for a teacher (reverts to platform fallback).
 */
export async function removeTeacherGeminiApiKey(teacherId: string): Promise<void> {
  if (!teacherId) throw new Error("Teacher ID is required.");

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("profiles")
    .update({ gemini_api_key: null })
    .eq("id", teacherId);

  if (error) {
    throw new Error(`Failed to remove Gemini API key: ${error.message}`);
  }
}
