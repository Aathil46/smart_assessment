"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  X,
  Play,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Copy,
  LogIn,
  Plus,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const GOOGLE_AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const VIDEO_TUTORIAL_URL = "https://youtube.com/shorts/gimu4UFFMnM?si=JA7n_ODQ8k3Z-Rs1";

export function TeacherAiCredentialsCard() {
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not Configured");

  const [inputKey, setInputKey] = useState("");
  const [showKeyText, setShowKeyText] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showHowToModal, setShowHowToModal] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  // Fetch credential status
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/teacher/credentials")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.hasKey) {
          setHasKey(true);
          setMaskedKey(data.maskedKey);
          setStatus(data.status || "Connected");
        } else {
          setHasKey(false);
          setMaskedKey(null);
          setStatus("Not Configured");
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to load credentials status:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveKey() {
    if (!inputKey.trim()) {
      setError("Please enter a valid Gemini API key.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/teacher/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: inputKey.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save API key.");
      }

      setHasKey(true);
      setMaskedKey(data.maskedKey);
      setStatus("Connected");
      setInputKey("");
      setIsReplacing(false);
      setShowKeyText(false);
      setSuccess("Gemini API key saved securely. It will be used for your AI generation requests.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/teacher/credentials", {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to remove API key.");
      }

      setHasKey(false);
      setMaskedKey(null);
      setStatus("Not Configured");
      setInputKey("");
      setIsReplacing(false);
      setShowConfirmRemove(false);
      setSuccess("Personal API key removed. Smart Assessment will now use the platform fallback key.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove API key.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card id="ai-credentials" className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-100 shadow-xs">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">AI Credentials</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  Configure your personal Gemini API key for assessment and material generation.
                </p>
              </div>
            </div>

            {hasKey && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {status}
              </span>
            )}
          </div>
        </CardHeader>

        <CardBody className="pt-5 pb-6 space-y-4">
          {/* Notifications */}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm font-medium animate-fade-in">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium animate-fade-in">
              <X className="h-4 w-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Gemini API Key + How to get? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="gemini-key-input" className="block text-xs sm:text-sm font-bold text-slate-900">
                Gemini API Key
              </label>

              {/* How to get? button */}
              <button
                type="button"
                id="btn-how-to-get-gemini-key"
                onClick={() => setShowHowToModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors py-1 px-2.5 rounded-lg hover:bg-teal-50/70 cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5 text-teal-600" />
                <span>How to get?</span>
              </button>
            </div>

            {loading ? (
              <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
            ) : hasKey && !isReplacing ? (
              /* Connected / Saved State */
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 tracking-wider">
                          {maskedKey}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Your personal key is active. Full key is never displayed again for security.
                      </p>
                    </div>
                  </div>

                  {/* Actions: Replace / Remove */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      id="btn-replace-gemini-key"
                      onClick={() => {
                        setIsReplacing(true);
                        setInputKey("");
                        setError(null);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Replace</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      id="btn-remove-gemini-key"
                      onClick={() => setShowConfirmRemove(true)}
                      className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Input State (New Key or Replacing) */
              <div className="space-y-3">
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="gemini-key-input"
                    type={showKeyText ? "text" : "password"}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    autoComplete="off"
                    className="w-full h-11 pl-10 pr-24 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-mono"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                      title={showKeyText ? "Hide key" : "Show key"}
                    >
                      {showKeyText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <Button
                      size="sm"
                      id="btn-save-gemini-key"
                      onClick={handleSaveKey}
                      loading={saving}
                      disabled={!inputKey.trim()}
                      className="h-8 px-3 text-xs bg-teal-600 hover:bg-teal-700"
                    >
                      {isReplacing ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>

                {isReplacing && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Updating key will overwrite your current configuration.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplacing(false);
                        setInputKey("");
                        setError(null);
                      }}
                      className="text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                    >
                      Cancel Replace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Links & Information Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {/* "Get API Key" link */}
            <a
              id="link-get-gemini-api-key"
              href={GOOGLE_AI_STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline transition-colors w-fit"
            >
              <span>Get API Key</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <p className="text-[11px] text-slate-400">
              Personal keys take priority. If removed, the shared platform key is used as fallback.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ─── Confirm Removal Dialog ─────────────────────────────────────── */}
      {showConfirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowConfirmRemove(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-100 p-5 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Remove Personal Key?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your AI requests will revert to using the shared platform Gemini API key.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmRemove(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemoveKey}
                loading={deleting}
              >
                Remove Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── How to get? Modal ─────────────────────────────────────────── */}
      {showHowToModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowHowToModal(false)}
          />

          <div
            className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-scale-in my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">How to get your Gemini API Key</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate a free API key from Google AI Studio in less than a minute.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHowToModal(false)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Step 1 — Open Google AI Studio
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Click <strong>&quot;Get API key&quot;</strong> or visit Google AI Studio directly.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Step 2 — Sign in
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sign in with your standard Google account.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Step 3 — Create an API key
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Follow the Google AI Studio instructions to create your API key (click <em>&quot;Create API key&quot;</em> in an existing or new project).
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  4
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Step 4 — Copy the API key
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Copy the generated key from Google AI Studio.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-xs flex-shrink-0 shadow-xs">
                  5
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Step 5 — Paste it here
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Return to Smart Assessment and paste the key into the Gemini API Key field, then click <strong>Save</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Link Button */}
            <div className="pt-1">
              <a
                href={GOOGLE_AI_STUDIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-all"
              >
                <span>Open Google AI Studio</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* Video Tutorial Link Card */}
            <div className="pt-2 border-t border-slate-100">
              <a
                href={VIDEO_TUTORIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <Play className="h-4 w-4 fill-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                      Watch video tutorial
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Quick step-by-step video demonstration on YouTube
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
              </a>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHowToModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
