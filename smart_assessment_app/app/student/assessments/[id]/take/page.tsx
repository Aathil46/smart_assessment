"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  Clock, ChevronLeft, ChevronRight, Flag, X, CheckCircle2,
  AlertCircle, Send, BookOpen, Calendar,
} from "lucide-react";
import { calculateEffectiveDeadline } from "@/lib/scheduling";

/* ───────────────────────────────────────────────────────────── types ── */
interface BackendQuestion {
  id: string;
  text: string;
  choices: string[];
  concept: string;
  difficulty: "easy" | "medium" | "hard";
}

interface BackendAttempt {
  id: string;
  assessment_id: string;
  started_at: string;
  duration_minutes?: number;
  effective_deadline?: string | null;
  server_time?: string;
}

interface BackendAssessment {
  id: string;
  title: string;
  topic: string | null;
  className: string;
  opens_at?: string | null;
  closes_at?: string | null;
  duration_minutes?: number;
}

interface AttemptData {
  attempt: BackendAttempt;
  assessment: BackendAssessment | null;
  questions: BackendQuestion[];
  answers: { question_id: string; selected_choice: string }[];
  error?: { code: string; message: string; opensAt?: string };
}

/* ─────────────────────────────────────────── countdown helpers ── */
function useCountdown(
  effectiveDeadline: string | null | undefined,
  onExpire?: () => void
) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!effectiveDeadline) return;
    const end = new Date(effectiveDeadline).getTime();
    if (isNaN(end)) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0 && !expiredRef.current) {
        expiredRef.current = true;
        if (onExpire) {
          onExpire();
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [effectiveDeadline, onExpire]);

  if (secondsLeft === null) return null;
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useStartCountdown(opensAt: string | null | undefined) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!opensAt) return;
    const target = new Date(opensAt).getTime();
    if (isNaN(target)) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opensAt]);

  if (secondsLeft === null) return null;
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/* ──────────────────────────────────────────── main component ── */
export default function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<AttemptData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [scheduledOpensAt, setScheduledOpensAt] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmit, setShowSubmit] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const savingRef = useRef<Record<string, boolean>>({});

  /* ─── load attempt ─── */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId: id }),
    })
      .then((r) => r.json())
      .then((payload: AttemptData) => {
        if (cancelled) return;
        if (payload.error) {
          if (payload.error.code === "NOT_STARTED" && payload.error.opensAt) {
            setScheduledOpensAt(payload.error.opensAt);
          }
          setLoadError(payload.error.message ?? "Unable to load assessment.");
          return;
        }
        /* Pre-populate answers from any saved backend answers */
        const saved: Record<string, string> = {};
        for (const a of payload.answers ?? []) {
          if (a.question_id && a.selected_choice) {
            saved[a.question_id] = a.selected_choice;
          }
        }
        setAnswers(saved);
        setData(payload);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Unable to load the assessment. Please try again.");
      });
    return () => { cancelled = true; };
  }, [id]);

  /* ─── submit ─── */
  const handleSubmit = useCallback(async () => {
    if (!data?.attempt?.id || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/attempts/${data.attempt.id}/submit`, { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => router.push(`/student/results/${data.attempt.id}`), 1500);
      } else {
        setSubmitError(result?.error?.message ?? "Unable to submit. Please try again.");
        setShowSubmit(false);
      }
    } catch {
      setSubmitError("Unable to submit. Please try again.");
      setShowSubmit(false);
    } finally {
      setSubmitting(false);
    }
  }, [data, submitting, router]);

  const effectiveDeadline = data?.attempt?.effective_deadline || (
    data?.attempt?.started_at
      ? new Date(
          calculateEffectiveDeadline(
            data.attempt.started_at,
            data.attempt.duration_minutes || 45,
            data.assessment?.closes_at
          )
        ).toISOString()
      : null
  );

  const timer = useCountdown(effectiveDeadline, handleSubmit);
  const startCountdown = useStartCountdown(scheduledOpensAt);

  /* ─── select answer ─── */
  const selectAnswer = useCallback(async (qid: string, choice: string) => {
    if (!data?.attempt?.id || timer === "00:00") return;
    setAnswers((prev) => ({ ...prev, [qid]: choice }));
    if (savingRef.current[qid]) return;
    savingRef.current[qid] = true;
    try {
      await fetch(`/api/attempts/${data.attempt.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: qid, selectedChoice: choice }),
      });
    } finally {
      savingRef.current[qid] = false;
    }
  }, [data, timer]);

  /* ─── loading ─── */
  if (!data && !loadError) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 mb-4" />
          <p className="text-sm text-slate-500">Loading assessment…</p>
        </div>
      </div>
    );
  }

  /* ─── scheduled early access ─── */
  if (scheduledOpensAt) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-soft">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mx-auto mb-4">
            <Calendar className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Assessment Scheduled</h2>
          <p className="text-sm text-slate-500 mb-6">{loadError}</p>
          {startCountdown && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Starts In
              </span>
              <span className="text-2xl font-bold text-brand-700 tabular-nums">
                {startCountdown}
              </span>
            </div>
          )}
          <Button variant="outline" onClick={() => router.push("/student/assessments")}>
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  /* ─── error ─── */
  if (loadError || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{loadError || "Assessment not found."}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/student/assessments")}
          >
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  /* ─── submitted splash ─── */
  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center animate-scale-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-success-100 text-success-600 mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Assessment Submitted!</h2>
          <p className="text-sm text-slate-500 mb-6">Your answers have been recorded. Redirecting to results…</p>
          <div className="flex justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-brand-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { questions, assessment, attempt } = data;
  const question = questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  /* adapt backend fields to Bolt's expected shape */
  const questionText = question?.text ?? "";
  const questionOptions: string[] = Array.isArray(question?.choices) ? question.choices : [];
  const questionDifficulty = question?.difficulty ?? "medium";

  return (
    <div className="max-w-3xl mx-auto">
      {submitError && (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          {submitError}
        </div>
      )}

      {/* ── Sticky header bar (exact Bolt layout) ── */}
      <div className="sticky top-16 z-10 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 mb-6 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExit(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">
                {assessment?.title ?? "Assessment"}
              </h1>
              <p className="text-2xs text-slate-400">{assessment?.className ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 tabular-nums">
              {timer ?? `${String(Math.floor(questions.length * 3)).padStart(2, "0")}:00`}
            </span>
          </div>
        </div>
        <Progress value={progress} size="md" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">{answeredCount} of {questions.length} answered</span>
          <span className="text-xs text-slate-500">Question {currentQ + 1} of {questions.length}</span>
        </div>
      </div>

      {/* ── Question card (exact Bolt layout) ── */}
      {question && (
        <div key={currentQ} className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
              {currentQ + 1}
            </span>
            <Badge variant="default" size="sm">Multiple Choice</Badge>
            <Badge
              variant={questionDifficulty === "easy" ? "success" : questionDifficulty === "medium" ? "warning" : "error"}
              size="sm"
            >
              {questionDifficulty}
            </Badge>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft mb-6">
            <p className="text-lg font-medium text-slate-900 mb-6 leading-relaxed">
              {questionText}
            </p>

            <div className="space-y-2.5">
              {questionOptions.map((opt, j) => {
                const isSelected = answers[question.id] === opt;
                return (
                  <button
                    key={j}
                    onClick={() => selectAnswer(question.id, opt)}
                    disabled={timer === "00:00" || submitting}
                    className={cn(
                      "flex w-full items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                      isSelected
                        ? "border-brand-500 bg-brand-50 shadow-glow-brand"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      (timer === "00:00" || submitting) && "opacity-60 cursor-not-allowed hover:border-slate-200 hover:bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0 transition-colors",
                        isSelected ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {isSelected ? <CheckCircle2 className="h-4 w-4" /> : String.fromCharCode(65 + j)}
                    </span>
                    <span className={cn("text-sm", isSelected ? "text-brand-900 font-medium" : "text-slate-700")}>
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation (exact Bolt layout) ── */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button onClick={() => setCurrentQ(currentQ + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="success" onClick={() => setShowSubmit(true)}>
            <Send className="h-4 w-4" /> Submit Assessment
          </Button>
        )}
      </div>

      {/* ── Question grid (exact Bolt layout) ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Questions</p>
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
          {questions.map((q, i) => {
            const isAnswered = !!answers[q.id];
            const isCurrent = i === currentQ;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQ(i)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-all",
                  isCurrent
                    ? "bg-brand-500 text-white ring-2 ring-brand-300 ring-offset-1"
                    : isAnswered
                    ? "bg-success-100 text-success-700 hover:bg-success-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-2xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-brand-500" /> Current
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-success-100" /> Answered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-slate-100" /> Unanswered
          </span>
        </div>
      </div>

      {/* ── Submit confirmation modal (exact Bolt layout) ── */}
      <Modal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        title="Submit Assessment?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowSubmit(false)}>Keep Working</Button>
            <Button variant="success" onClick={handleSubmit} loading={submitting}>
              <Send className="h-4 w-4" /> Submit Now
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <div className="flex-1">
              <p className="text-sm text-slate-700">
                Answered: <span className="font-bold">{answeredCount}</span> / {questions.length}
              </p>
              <p className="text-sm text-slate-700">
                Unanswered:{" "}
                <span className="font-bold text-error-600">{questions.length - answeredCount}</span>
              </p>
            </div>
          </div>
          {questions.length - answeredCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 border border-warning-200">
              <AlertCircle className="h-4 w-4 text-warning-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning-700">
                You have {questions.length - answeredCount} unanswered question(s). You can still
                submit, but unanswered questions will be marked as incorrect.
              </p>
            </div>
          )}
          <p className="text-sm text-slate-500">
            Once submitted, you cannot change your answers. Your results will be available immediately.
          </p>
        </div>
      </Modal>

      {/* ── Exit confirmation modal (exact Bolt layout) ── */}
      <Modal
        open={showExit}
        onClose={() => setShowExit(false)}
        title="Leave Assessment?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowExit(false)}>Stay</Button>
            <Button variant="danger" onClick={() => router.push("/student/assessments")}>Leave</Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Your progress will be saved and you can resume later. Are you sure you want to leave?
        </p>
      </Modal>
    </div>
  );
}
