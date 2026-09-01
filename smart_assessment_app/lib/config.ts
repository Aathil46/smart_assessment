export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}
