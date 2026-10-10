import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface TeacherNotificationItem {
  id: string;
  type: "assessment_completed" | "results_available" | "student_submission" | "ai_insight" | "student_joined";
  title: string;
  description: string;
  timestamp: string;
  rawTimestamp: string;
  actionUrl: string;
  read?: boolean;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Recently";
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return "Recently";
  const diffSec = Math.floor((Date.now() - time) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, dismissed_notifications")
      .eq("id", auth.user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    const profileDismissed = Array.isArray((profile as any)?.dismissed_notifications)
      ? (profile as any).dismissed_notifications
      : [];
    const metaDismissed = Array.isArray(auth.user.user_metadata?.dismissed_notifications)
      ? auth.user.user_metadata.dismissed_notifications
      : [];
    const dismissedSet = new Set<string>([...profileDismissed, ...metaDismissed]);

    // 1. Fetch teacher classes
    const { data: classes } = await admin
      .from("classes")
      .select("id, name, subject, code, created_at")
      .eq("teacher_id", auth.user.id);

    const classMap = new Map((classes ?? []).map((c) => [c.id, c]));
    const classIds = (classes ?? []).map((c) => c.id);

    // 2. Fetch teacher assessments
    const { data: assessments } = await admin
      .from("assessments")
      .select("id, title, class_id, status, closes_at, created_at, ai_insights, ai_insights_generated_at")
      .eq("created_by", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    const assessmentList = assessments ?? [];
    const assessmentIds = assessmentList.map((a) => a.id);
    const assessmentMap = new Map(assessmentList.map((a) => [a.id, a]));

    // 3. Fetch attempts for teacher's assessments
    const { data: attempts } = assessmentIds.length > 0
      ? await admin
          .from("attempts")
          .select("id, assessment_id, student_id, score, total, submitted_at, created_at")
          .in("assessment_id", assessmentIds)
          .order("submitted_at", { ascending: false })
          .limit(60)
      : { data: [] };

    const attemptsList = attempts ?? [];

    // 4. Fetch recent class members
    const { data: members } = classIds.length > 0
      ? await admin
          .from("class_members")
          .select("id, class_id, student_id, joined_at")
          .in("class_id", classIds)
          .order("joined_at", { ascending: false })
          .limit(30)
      : { data: [] };

    const memberList = members ?? [];

    // 5. Fetch profiles of students involved
    const studentIds = [
      ...new Set([
        ...attemptsList.map((att) => att.student_id),
        ...memberList.map((m) => m.student_id),
      ]),
    ].filter(Boolean);

    const { data: studentProfiles } = studentIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, name, email")
          .in("id", studentIds)
      : { data: [] };

    const studentMap = new Map((studentProfiles ?? []).map((p) => [p.id, p]));

    // Build notifications collection
    const notifications: TeacherNotificationItem[] = [];
    const now = Date.now();

    // A. Assessment completed & Results available notifications
    const attemptsByAssessment = new Map<string, typeof attemptsList>();
    for (const att of attemptsList) {
      const list = attemptsByAssessment.get(att.assessment_id) ?? [];
      list.push(att);
      attemptsByAssessment.set(att.assessment_id, list);
    }

    for (const a of assessmentList) {
      if (a.status !== "published") continue;
      const atts = (attemptsByAssessment.get(a.id) ?? []).filter((at) => at.submitted_at !== null);
      const classInfo = a.class_id ? classMap.get(a.class_id) : null;
      const className = classInfo ? classInfo.name : "Class";

      if (atts.length > 0) {
        // Results available notification
        let scoreSum = 0;
        for (const att of atts) {
          if (att.total && att.total > 0 && att.score !== null) {
            scoreSum += (att.score / att.total) * 100;
          }
        }
        const avg = Math.round(scoreSum / atts.length);
        const latestSubmitTime = atts[0]?.submitted_at || a.created_at;

        notifications.push({
          id: `notif-res-${a.id}`,
          type: "results_available",
          title: `${a.title} results are ready`,
          description: `${atts.length} student submission${atts.length !== 1 ? "s" : ""} evaluated · Average score ${avg}%`,
          timestamp: formatRelativeTime(latestSubmitTime),
          rawTimestamp: latestSubmitTime,
          actionUrl: `/teacher/results/${a.id}`,
        });

        // Assessment completed notification (if closed or 3+ submissions)
        const isClosed = a.closes_at && new Date(a.closes_at).getTime() <= now;
        if (isClosed || atts.length >= 3) {
          const compTime = a.closes_at || latestSubmitTime;
          notifications.push({
            id: `notif-comp-${a.id}`,
            type: "assessment_completed",
            title: `${a.title} completed`,
            description: `Assessment window closed for ${className}. All ${atts.length} submissions recorded.`,
            timestamp: formatRelativeTime(compTime),
            rawTimestamp: compTime,
            actionUrl: `/teacher/results/${a.id}`,
          });
        }
      }

      // AI insight generated notification
      if (a.ai_insights) {
        const insightTime = (a as any).ai_insights_generated_at || a.created_at;
        notifications.push({
          id: `notif-ins-${a.id}`,
          type: "ai_insight",
          title: `AI Insight: ${a.title}`,
          description: `Instructional review and concept breakdown ready for review.`,
          timestamp: formatRelativeTime(insightTime),
          rawTimestamp: insightTime,
          actionUrl: `/teacher/insights`,
        });
      }
    }

    // B. New student submission notifications (up to 8 most recent)
    for (const att of attemptsList.slice(0, 8)) {
      if (!att.submitted_at) continue;
      const student = studentMap.get(att.student_id);
      const studentName = student?.name || "A student";
      const assessment = assessmentMap.get(att.assessment_id);
      const assessmentTitle = assessment?.title || "Assessment";
      const scorePct = att.total && att.total > 0 && att.score !== null
        ? Math.round((att.score / att.total) * 100)
        : null;

      notifications.push({
        id: `notif-sub-${att.id}`,
        type: "student_submission",
        title: `New submission: ${studentName}`,
        description: `Submitted ${assessmentTitle}${scorePct !== null ? ` (${scorePct}%)` : ""}.`,
        timestamp: formatRelativeTime(att.submitted_at),
        rawTimestamp: att.submitted_at,
        actionUrl: `/teacher/results/${att.assessment_id}`,
      });
    }

    // C. New student joined class notifications (up to 6 most recent)
    for (const m of memberList.slice(0, 6)) {
      const student = studentMap.get(m.student_id);
      const studentName = student?.name || "A new student";
      const classInfo = classMap.get(m.class_id);
      const className = classInfo?.name || "your class";
      const joinTime = (m as any).joined_at || (classInfo as any)?.created_at || new Date().toISOString();

      notifications.push({
        id: `notif-join-${m.id || `${m.student_id}_${m.class_id}`}`,
        type: "student_joined",
        title: `New student joined`,
        description: `${studentName} enrolled in ${className}.`,
        timestamp: formatRelativeTime(joinTime),
        rawTimestamp: joinTime,
        actionUrl: `/teacher/classes/${m.class_id}`,
      });
    }

    // Deduplicate and filter out dismissed notifications
    const seenIds = new Set<string>();
    const activeNotifications: TeacherNotificationItem[] = [];

    for (const n of notifications) {
      if (dismissedSet.has(n.id)) continue;
      if (seenIds.has(n.id)) continue;
      seenIds.add(n.id);
      activeNotifications.push(n);
    }

    // Sort descending by rawTimestamp (newest first)
    activeNotifications.sort((a, b) => {
      const timeA = new Date(a.rawTimestamp).getTime() || 0;
      const timeB = new Date(b.rawTimestamp).getTime() || 0;
      return timeB - timeA;
    });

    return NextResponse.json({
      notifications: activeNotifications.slice(0, 25),
    });
  } catch (error) {
    console.error("[Teacher Notifications GET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load notifications." } },
      { status: 500 }
    );
  }
}
