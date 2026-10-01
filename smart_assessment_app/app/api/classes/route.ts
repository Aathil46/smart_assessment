import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classSchema } from "@/lib/validation";
import { generateClassCode } from "@/lib/utils";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profile?.role === "student") {
      const { data: memberships, error: memberError } = await admin
        .from("class_members")
        .select("class_id, joined_at")
        .eq("student_id", userData.user.id)
        .order("joined_at", { ascending: false });

      if (memberError) {
        throw new Error(memberError.message);
      }

      if (!memberships || memberships.length === 0) {
        return NextResponse.json({ classes: [] });
      }

      const classIds = memberships.map((m) => m.class_id);

      const { data: classesData, error: classesError } = await admin
        .from("classes")
        .select("id, name, subject, grade, code, teacher_id, created_at")
        .in("id", classIds);

      if (classesError) {
        throw new Error(classesError.message);
      }

      const teacherIds = [...new Set((classesData ?? []).map((c) => c.teacher_id).filter(Boolean))];
      const { data: teachers } = teacherIds.length > 0
        ? await admin.from("profiles").select("id, name, email").in("id", teacherIds)
        : { data: [] };

      const { data: assessments } = await admin
        .from("assessments")
        .select("id, class_id, title, status, opens_at, closes_at, created_at")
        .in("class_id", classIds)
        .eq("status", "published");

      const assessmentIds = (assessments ?? []).map((a) => a.id);
      const { data: attempts } = assessmentIds.length > 0
        ? await admin
            .from("attempts")
            .select("id, assessment_id, score, total, submitted_at")
            .eq("student_id", userData.user.id)
            .in("assessment_id", assessmentIds)
        : { data: [] };

      const classMap = new Map((classesData ?? []).map((c) => [c.id, c]));
      const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.name]));
      const now = Date.now();

      const enrolledClasses = memberships
        .map((m) => {
          const c = classMap.get(m.class_id);
          if (!c) return null;

          const teacherName = teacherMap.get(c.teacher_id) || "Teacher";
          const classAssessments = (assessments ?? []).filter((a) => a.class_id === c.id);

          const classAssessmentIds = new Set(classAssessments.map((a) => a.id));
          const classAttempts = (attempts ?? []).filter(
            (at) => classAssessmentIds.has(at.assessment_id) && at.submitted_at !== null && at.total && at.total > 0
          );

          let avgScore: number | null = null;
          if (classAttempts.length > 0) {
            const totalPct = classAttempts.reduce((sum, at) => sum + ((at.score ?? 0) / at.total) * 100, 0);
            avgScore = Math.round(totalPct / classAttempts.length);
          }

          const submittedIds = new Set(classAttempts.map((at) => at.assessment_id));
          const pendingAssessments = classAssessments.filter((a) => {
            if (submittedIds.has(a.id)) return false;
            if (a.closes_at && new Date(a.closes_at).getTime() <= now) return false;
            return true;
          });

          pendingAssessments.sort((a, b) => {
            if (a.closes_at && b.closes_at) return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
            if (a.closes_at) return -1;
            if (b.closes_at) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          const nextAssessment = pendingAssessments[0]?.title ?? null;

          return {
            id: c.id,
            name: c.name,
            subject: c.subject || null,
            grade: c.grade || null,
            code: c.code,
            teacher: teacherName,
            assessmentCount: classAssessments.length,
            avgScore,
            nextAssessment,
            joinedAt: m.joined_at,
            createdAt: c.created_at,
          };
        })
        .filter(Boolean);

      return NextResponse.json({ classes: enrolledClasses });
    }

    const { data, error } = await admin
      .from("classes")
      .select("*")
      .eq("teacher_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const classIds = (data ?? []).map((c) => c.id);

    // Student counts
    const { data: memberRows } = classIds.length > 0
      ? await admin.from("class_members").select("class_id").in("class_id", classIds)
      : { data: [] };
    const studentCounts: Record<string, number> = {};
    for (const m of memberRows ?? []) {
      studentCounts[m.class_id] = (studentCounts[m.class_id] || 0) + 1;
    }

    // Assessment counts
    const { data: assessmentRows } = classIds.length > 0
      ? await admin.from("assessments").select("id, class_id").in("class_id", classIds)
      : { data: [] };
    const assessmentCounts: Record<string, number> = {};
    const assessmentIdsByClass: Record<string, string[]> = {};
    for (const a of assessmentRows ?? []) {
      assessmentCounts[a.class_id] = (assessmentCounts[a.class_id] || 0) + 1;
      if (!assessmentIdsByClass[a.class_id]) assessmentIdsByClass[a.class_id] = [];
      assessmentIdsByClass[a.class_id].push(a.id);
    }

    // Average performance per class from submitted attempts
    const allAssessmentIds = (assessmentRows ?? []).map((a) => a.id);
    const { data: attemptRows } = allAssessmentIds.length > 0
      ? await admin.from("attempts").select("assessment_id, score, total").in("assessment_id", allAssessmentIds).not("submitted_at", "is", null)
      : { data: [] };
    const avgPerformances: Record<string, number | null> = {};
    for (const classId of classIds) {
      const ids = new Set(assessmentIdsByClass[classId] ?? []);
      const classAttempts = (attemptRows ?? []).filter((at) => ids.has(at.assessment_id) && at.total && at.total > 0);
      if (classAttempts.length > 0) {
        const totalPct = classAttempts.reduce((sum, at) => sum + ((at.score ?? 0) / at.total) * 100, 0);
        avgPerformances[classId] = Math.round(totalPct / classAttempts.length);
      } else {
        avgPerformances[classId] = null;
      }
    }

    const enrichedClasses = (data ?? []).map((c) => ({
      ...c,
      studentCount: studentCounts[c.id] ?? 0,
      assessmentCount: assessmentCounts[c.id] ?? 0,
      avgPerformance: avgPerformances[c.id] ?? null,
    }));

    return NextResponse.json({ classes: enrichedClasses });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = classSchema.parse(body);
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, { status: 401 });
    }

    const profileResult = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileResult.error || profileResult.data?.role !== "teacher") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Teacher access required." } }, { status: 403 });
    }

    const code = generateClassCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({
        id: randomUUID(),
        teacher_id: userData.user.id,
        name: payload.name,
        subject: payload.subject || null,
        grade: payload.grade || null,
        code,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ id: data.id, code: data.code, name: data.name }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid class payload." } },
        { status: 400 },
      );
    }

    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}
