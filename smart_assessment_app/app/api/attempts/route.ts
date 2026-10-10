import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateEffectiveDeadline } from "@/lib/scheduling";

export async function POST(request: Request) {
  const { assessmentId } = await request.json();
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data: assessment } = await admin.from("assessments").select("*").eq("id", assessmentId).single();
  const { data: member } = assessment
    ? await admin.from("class_members").select("class_id").eq("class_id", assessment.class_id).eq("student_id", auth.user.id).single()
    : { data: null };

  const now = Date.now();
  if (!assessment || !member || assessment.status !== "published") {
    return NextResponse.json({ error: { code: "NOT_AVAILABLE", message: "Assessment is not available." } }, { status: 403 });
  }

  // Calculate duration
  const { data: questions } = await admin.from("questions").select("id").eq("assessment_id", assessmentId);
  const qCount = questions?.length || assessment.num_questions || 10;
  const durationMinutes = (assessment as any).duration_minutes || Math.max(5, qCount * 3);

  // Check for an existing in-progress attempt (student already started)
  const { data: existing } = await admin
    .from("attempts")
    .select("id,submitted_at,started_at")
    .eq("assessment_id", assessmentId)
    .eq("student_id", auth.user.id)
    .is("submitted_at", null)
    .maybeSingle();

  if (existing) {
    // Students who started on time may continue until effective deadline
    const effectiveDeadline = calculateEffectiveDeadline(
      existing.started_at,
      durationMinutes,
      assessment.closes_at
    );
    if (now > effectiveDeadline) {
      return NextResponse.json(
        { error: { code: "TIME_LIMIT_EXCEEDED", message: "The time limit for this assessment has ended." } },
        { status: 403 }
      );
    }
    return attemptResponse(admin, existing.id, durationMinutes, effectiveDeadline);
  }

  // Starting a NEW attempt:
  // 1. Prevent starting before scheduled start time
  if (assessment.opens_at && new Date(assessment.opens_at).getTime() > now) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_STARTED",
          message: `This assessment is scheduled to start at ${new Date(assessment.opens_at).toLocaleString()}.`,
          opensAt: assessment.opens_at,
        },
      },
      { status: 403 }
    );
  }

  // 2. Prevent starting new attempts after scheduled end time
  if (assessment.closes_at && new Date(assessment.closes_at).getTime() <= now) {
    return NextResponse.json(
      { error: { code: "NOT_AVAILABLE", message: "This assessment has closed." } },
      { status: 403 }
    );
  }

  // 3. Attempt limit
  const { count } = await admin
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .eq("student_id", auth.user.id);

  if ((count ?? 0) >= assessment.attempt_limit) {
    return NextResponse.json({ error: { code: "ATTEMPT_LIMIT", message: "Attempt limit reached." } }, { status: 409 });
  }

  // 4. Create new attempt with server started_at timestamp
  const startedAtIso = new Date(now).toISOString();
  const { data: attempt, error } = await admin
    .from("attempts")
    .insert({
      id: randomUUID(),
      assessment_id: assessmentId,
      student_id: auth.user.id,
      started_at: startedAtIso,
    })
    .select("id")
    .single();

  if (error || !attempt) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error?.message ?? "Unable to start attempt." } },
      { status: 500 }
    );
  }

  const effectiveDeadline = calculateEffectiveDeadline(startedAtIso, durationMinutes, assessment.closes_at);
  return attemptResponse(admin, attempt.id, durationMinutes, effectiveDeadline);
}

async function attemptResponse(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  attemptId: string,
  durationMinutes?: number,
  effectiveDeadlineMs?: number
) {
  const { data: attempt } = await admin.from("attempts").select("id,assessment_id,started_at").eq("id", attemptId).single();
  const { data: assessmentRow } = await admin
    .from("assessments")
    .select("id,title,topic,class_id,opens_at,closes_at,classes(id,name)")
    .eq("id", attempt?.assessment_id)
    .single();

  const classObj = assessmentRow
    ? (Array.isArray((assessmentRow as any).classes) ? (assessmentRow as any).classes[0] : (assessmentRow as any).classes)
    : null;
  const { data: questions } = await admin.from("questions").select("id,text,choices,concept,difficulty").eq("assessment_id", attempt?.assessment_id).order("created_at");
  const { data: answers } = await admin.from("answers").select("question_id,selected_choice").eq("attempt_id", attemptId);

  const dur = durationMinutes || (assessmentRow as any)?.duration_minutes || Math.max(5, (questions?.length || 10) * 3);
  const deadline = effectiveDeadlineMs || (attempt?.started_at ? calculateEffectiveDeadline(attempt.started_at, dur, assessmentRow?.closes_at) : null);

  const assessment = assessmentRow
    ? {
        id: assessmentRow.id,
        title: assessmentRow.title,
        topic: assessmentRow.topic,
        className: classObj?.name ?? "Class",
        opens_at: assessmentRow.opens_at,
        closes_at: assessmentRow.closes_at,
        duration_minutes: dur,
      }
    : null;

  return NextResponse.json({
    attempt: attempt
      ? {
          ...attempt,
          duration_minutes: dur,
          effective_deadline: deadline ? new Date(deadline).toISOString() : null,
          server_time: new Date().toISOString(),
        }
      : null,
    assessment,
    questions: questions ?? [],
    answers: answers ?? [],
  });
}