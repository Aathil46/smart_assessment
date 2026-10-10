import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assessmentSchema } from "@/lib/validation";

import { calculateEffectiveDeadline } from "@/lib/scheduling";

export async function POST(request: Request) {
  try {
    const payload = assessmentSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (profileError || profile?.role !== "teacher") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Teacher access required." } }, { status: 403 });
    }
    const user = auth.user;
    const admin = createAdminSupabaseClient();
    const { data: klass } = await admin.from("classes").select("id").eq("id", payload.classId).eq("teacher_id", user.id).single();
    const { data: material } = await admin.from("materials").select("id,status").eq("id", payload.materialId).eq("class_id", payload.classId).single();
    if (!klass || material?.status !== "processed") return NextResponse.json({ error: { code: "INVALID_MATERIAL", message: "Choose a processed material from your class." } }, { status: 400 });
    const { data, error } = await admin
      .from("assessments")
      .insert({
        id: randomUUID(),
        class_id: payload.classId,
        material_id: payload.materialId,
        title: payload.title,
        topic: payload.topic || payload.title,
        num_questions: payload.numQuestions,
        difficulty: payload.difficulty,
        opens_at: payload.opensAt ? new Date(payload.opensAt).toISOString() : null,
        closes_at: payload.closesAt ? new Date(payload.closesAt).toISOString() : null,
        created_by: user.id,
        status: "draft",
      })
      .select("id,status")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid assessment." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unable to create assessment." } }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).single();
  if (profile?.role === "teacher") {
    const { data } = await admin
      .from("assessments")
      .select("*, classes(id, name, subject), questions(id)")
      .eq("created_by", auth.user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ assessments: data ?? [] });
  }
  const { data: memberships } = await admin.from("class_members").select("class_id").eq("student_id", auth.user.id);
  const classIds = (memberships ?? []).map((item) => item.class_id);
  if (!classIds.length) {
    return NextResponse.json({ assessments: [], toDo: [], completed: [] });
  }

  const { data: rawAssessments } = await admin
    .from("assessments")
    .select("id,class_id,title,topic,difficulty,status,opens_at,closes_at,attempt_limit,created_at,classes(id,name,subject,teacher_id),questions(id)")
    .eq("status", "published")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

  const teacherIds = [...new Set((rawAssessments ?? []).map((a: any) => {
    const c = Array.isArray(a.classes) ? a.classes[0] : a.classes;
    return c?.teacher_id;
  }).filter(Boolean))];
  const { data: teachers } = teacherIds.length > 0
    ? await admin.from("profiles").select("id,name").in("id", teacherIds)
    : { data: [] };
  const teacherMap = new Map((teachers ?? []).map((t: any) => [t.id, t.name]));

  const assessmentIds = (rawAssessments ?? []).map((a: any) => a.id);
  const { data: rawAttempts } = assessmentIds.length > 0
    ? await admin
        .from("attempts")
        .select("id,assessment_id,score,total,started_at,submitted_at,created_at")
        .eq("student_id", auth.user.id)
        .in("assessment_id", assessmentIds)
        .order("submitted_at", { ascending: false })
    : { data: [] };

  const attemptsByAssessment = new Map<string, any[]>();
  for (const att of (rawAttempts ?? [])) {
    const list = attemptsByAssessment.get(att.assessment_id) ?? [];
    list.push(att);
    attemptsByAssessment.set(att.assessment_id, list);
  }

  const now = Date.now();
  const toDo: any[] = [];
  const completed: any[] = [];
  const allStudentAssessments: any[] = [];

  for (const a of (rawAssessments ?? [])) {
    const classObj = (Array.isArray(a.classes) ? a.classes[0] : a.classes) as { id?: string; name?: string; subject?: string | null; teacher_id?: string } | null;
    const atts = attemptsByAssessment.get(a.id) ?? [];
    const submittedAttempt = atts.find((att: any) => att.submitted_at !== null);
    const inProgressAttempt = atts.find((att: any) => att.submitted_at === null);
    const teacherName = (classObj?.teacher_id ? teacherMap.get(classObj.teacher_id) : null) || "Teacher";
    const questionCount = a.questions?.length || 0;
    const duration = Math.max(5, (questionCount || 10) * 3);

    if (submittedAttempt) {
      const scorePct = submittedAttempt.total && submittedAttempt.total > 0
        ? Math.round((submittedAttempt.score / submittedAttempt.total) * 100)
        : (submittedAttempt.score ?? 0);
      const passed = scorePct >= 60;
      const completedItem = {
        id: a.id,
        attemptId: submittedAttempt.id,
        title: a.title,
        topic: a.topic,
        classId: a.class_id,
        className: classObj?.name ?? "Class",
        subject: classObj?.subject,
        teacher: teacherName,
        questions: questionCount,
        duration,
        score: scorePct,
        passed,
        submittedAt: submittedAttempt.submitted_at,
        completedDate: submittedAttempt.submitted_at
          ? new Date(submittedAttempt.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—",
        status: "completed",
      };
      completed.push(completedItem);
      allStudentAssessments.push(completedItem);
    } else {
      const isBeforeStart = a.opens_at ? new Date(a.opens_at).getTime() > now : false;
      const isPastClose = a.closes_at ? new Date(a.closes_at).getTime() <= now : false;

      let canInclude = false;
      let status: 'not-started' | 'in-progress' = 'not-started';

      if (inProgressAttempt) {
        // If student started on time, calculate effective deadline
        const effectiveDeadline = calculateEffectiveDeadline(
          inProgressAttempt.started_at,
          duration,
          a.closes_at
        );
        if (now <= effectiveDeadline) {
          canInclude = true;
          status = 'in-progress';
        }
      } else {
        // No attempt started yet
        if (isBeforeStart) {
          // Scheduled in the future: show with scheduled time & countdown
          canInclude = true;
          status = 'not-started';
        } else if (!isPastClose) {
          // In the open window or unscheduled
          canInclude = true;
          status = 'not-started';
        }
      }

      if (canInclude) {
        const toDoItem = {
          id: a.id,
          attemptId: inProgressAttempt?.id ?? null,
          title: a.title,
          topic: a.topic,
          classId: a.class_id,
          className: classObj?.name ?? "Class",
          subject: classObj?.subject,
          teacher: teacherName,
          questions: questionCount,
          duration,
          status,
          dueDate: a.closes_at
            ? new Date(a.closes_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "No deadline",
          opensAt: a.opens_at,
          closesAt: a.closes_at,
        };
        toDo.push(toDoItem);
        allStudentAssessments.push(toDoItem);
      }
    }
  }

  return NextResponse.json({ assessments: allStudentAssessments, toDo, completed });
}