import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classifyConceptLevel, determinePassFail } from "@/lib/conceptEngine";

export interface TeachingInsight {
  id: string;
  classId: string;
  className: string;
  type: "concept-gap" | "student-support" | "teaching-strategy" | "positive";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  affectedStudents?: string[];
  concept?: string;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
      { status: 401 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "teacher") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Teacher access required." } },
      { status: 403 }
    );
  }

  // 1. Fetch teacher's classes
  const { data: teacherClasses } = await admin
    .from("classes")
    .select("id, name, subject")
    .eq("teacher_id", auth.user.id);

  const classesList = teacherClasses ?? [];
  if (classesList.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const classIds = classesList.map((c) => c.id);
  const classMap = new Map<string, string>(
    classesList.map((c) => [c.id, c.name ? c.name.replace(/^"|"$/g, "") : "Class"])
  );

  // 2. Fetch class members & profiles
  const { data: members } = await admin
    .from("class_members")
    .select("class_id, student_id")
    .in("class_id", classIds);

  const memberList = members ?? [];
  const studentIds = [...new Set(memberList.map((m) => m.student_id))];

  let profileMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name || "Student"]));
  }

  // 3. Fetch assessments for these classes
  const { data: assessments } = await admin
    .from("assessments")
    .select("id, class_id, title, topic, status")
    .in("class_id", classIds);

  const assessmentList = assessments ?? [];
  if (assessmentList.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const assessmentIds = assessmentList.map((a) => a.id);

  // 4. Fetch completed attempts
  const { data: attempts } = await admin
    .from("attempts")
    .select("id, assessment_id, student_id, score, total, started_at, submitted_at")
    .in("assessment_id", assessmentIds)
    .not("submitted_at", "is", null);

  const attemptList = attempts ?? [];
  if (attemptList.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const attemptIds = attemptList.map((a) => a.id);

  // 5. Fetch concept performance and learning gaps for completed attempts
  const [{ data: conceptPerfs }, { data: learningGaps }] = await Promise.all([
    admin
      .from("concept_perf")
      .select("attempt_id, concept, correct_count, total_count, accuracy, level")
      .in("attempt_id", attemptIds),
    admin
      .from("learning_gaps")
      .select("attempt_id, concept, gap_level, notes, recommendations")
      .in("attempt_id", attemptIds),
  ]);

  // Map attempt -> assessment and attempt -> student
  const attemptMap = new Map<string, any>(attemptList.map((a) => [a.id, a]));
  const assessmentMap = new Map<string, any>(assessmentList.map((a) => [a.id, a]));

  // Build learning gaps lookup by concept
  const gapsByConcept = new Map<string, any[]>();
  for (const gap of learningGaps ?? []) {
    const list = gapsByConcept.get(gap.concept) ?? [];
    list.push(gap);
    gapsByConcept.set(gap.concept, list);
  }

  // 6. Aggregate per class
  const insights: TeachingInsight[] = [];

  for (const klass of classesList) {
    const className = classMap.get(klass.id) || "Class";
    const classAssessments = assessmentList.filter((a) => a.class_id === klass.id);
    const classAssessmentIds = new Set(classAssessments.map((a) => a.id));

    // Attempts in this class
    const classAttempts = attemptList.filter((a) => classAssessmentIds.has(a.assessment_id));
    if (classAttempts.length === 0) continue;

    // Pick latest attempt per student
    const studentLatestAttempt = new Map<string, any>();
    for (const att of classAttempts) {
      const existing = studentLatestAttempt.get(att.student_id);
      if (!existing || new Date(att.submitted_at) > new Date(existing.submitted_at)) {
        studentLatestAttempt.set(att.student_id, att);
      }
    }

    // Identify struggling students
    const strugglingStudents: { id: string; name: string }[] = [];
    for (const [studentId, att] of studentLatestAttempt.entries()) {
      const isFailed = determinePassFail(att.score ?? 0, att.total ?? 0) === "Fail";
      const pct = att.total && att.total > 0 ? ((att.score ?? 0) / att.total) * 100 : 0;
      if (isFailed || pct < 50) {
        strugglingStudents.push({
          id: studentId,
          name: profileMap.get(studentId) || "Student",
        });
      }
    }

    // Concept aggregation in this class
    const classAttemptIds = new Set(classAttempts.map((a) => a.id));
    const classConcepts = new Map<
      string,
      { correct: number; total: number; strugglingStudents: Set<string> }
    >();

    for (const cp of conceptPerfs ?? []) {
      if (!classAttemptIds.has(cp.attempt_id)) continue;
      const att = attemptMap.get(cp.attempt_id);
      if (!att) continue;

      if (!classConcepts.has(cp.concept)) {
        classConcepts.set(cp.concept, {
          correct: 0,
          total: 0,
          strugglingStudents: new Set(),
        });
      }

      const entry = classConcepts.get(cp.concept)!;
      entry.correct += cp.correct_count;
      entry.total += cp.total_count;

      const acc = Number(cp.accuracy);
      if (acc < 0.5 || cp.level === "Weak") {
        const studentName = profileMap.get(att.student_id);
        if (studentName) entry.strugglingStudents.add(studentName);
      }
    }

    // Generate Concept Gap insights (High priority)
    for (const [concept, stats] of classConcepts.entries()) {
      if (stats.total === 0) continue;
      const ratio = stats.correct / stats.total;
      const accuracyPct = Math.round(ratio * 100);
      const level = classifyConceptLevel(ratio);

      if (level === "Weak") {
        const affected = Array.from(stats.strugglingStudents);
        const relatedGaps = gapsByConcept.get(concept) ?? [];
        let recommendedAction = `Schedule a focused review session on ${concept}, with step-by-step worked examples.`;
        if (relatedGaps.length > 0 && relatedGaps[0].recommendations) {
          const recs = Array.isArray(relatedGaps[0].recommendations)
            ? relatedGaps[0].recommendations
            : [];
          if (recs.length > 0) {
            recommendedAction = typeof recs[0] === "string" ? recs[0] : JSON.stringify(recs[0]);
          }
        }

        insights.push({
          id: `insight-gap-${klass.id}-${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          classId: klass.id,
          className,
          type: "concept-gap",
          priority: "high",
          title: `${concept} needs reinforcement`,
          description: `${100 - accuracyPct}% error rate on ${concept}. Multiple students scored below 50% on this topic in ${className}.`,
          action: recommendedAction,
          affectedStudents: affected.length > 0 ? affected : undefined,
          concept,
        });
      } else if (level === "Strong") {
        // Positive insight (Low priority)
        insights.push({
          id: `insight-pos-${klass.id}-${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          classId: klass.id,
          className,
          type: "positive",
          priority: "low",
          title: `${concept} mastery is strong`,
          description: `${accuracyPct}% of questions on ${concept} answered correctly in ${className}. This concept is well-established.`,
          action: `Use this solid foundation to introduce more advanced applications and problem-solving.`,
          concept,
        });
      } else {
        // Teaching Strategy (Medium priority)
        insights.push({
          id: `insight-strat-${klass.id}-${concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          classId: klass.id,
          className,
          type: "teaching-strategy",
          priority: "medium",
          title: `${concept} understanding is developing`,
          description: `Students achieved an average accuracy of ${accuracyPct}% on ${concept} in ${className}. Further practice will help solidify proficiency.`,
          action: `Incorporate interactive problem-solving or paired exercises on ${concept} into upcoming lessons.`,
          concept,
        });
      }
    }

    // Generate Student Support insight if multiple struggling students (High priority)
    if (strugglingStudents.length > 0) {
      const names = strugglingStudents.map((s) => s.name);
      const displayNames = names.slice(0, 3).join(", ");
      const extra = names.length > 3 ? ` and ${names.length - 3} other${names.length - 3 === 1 ? "" : "s"}` : "";

      insights.push({
        id: `insight-support-${klass.id}`,
        classId: klass.id,
        className,
        type: "student-support",
        priority: "high",
        title: `${strugglingStudents.length} student${strugglingStudents.length === 1 ? "" : "s"} may need additional support`,
        description: `${displayNames}${extra} scored below 50% on recent assessments in ${className}.`,
        action: `Consider small-group tutoring or targeted intervention sessions focused on their weak concepts.`,
        affectedStudents: names,
      });
    }
  }

  return NextResponse.json({ insights });
}
