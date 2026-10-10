import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface DashboardClass {
  id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  code: string;
  studentCount: number;
  assessmentCount: number;
  avgPerformance: number | null;
}

export interface DashboardTrendPoint {
  assessmentId: string;
  classId?: string;
  title: string;
  className: string;
  date: string;
  fullDate: string;
  avgScore: number;
  submissionsCount: number;
}

export interface DashboardTopPerformer {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  className: string;
  avgScore: number;
  assessmentsCount: number;
  rank: number;
}

export interface DashboardWeakConcept {
  concept: string;
  studentCount: number;
  priority: "high" | "medium" | "low";
  assessmentId: string | null;
  assessmentTitle: string | null;
  className: string | null;
}

export interface DashboardNotification {
  id: string;
  type: "assessment_completed" | "results_available" | "weak_concept_detected";
  title: string;
  description: string;
  timestamp: string;
  actionUrl: string;
  priority: "high" | "medium" | "low";
}

export interface TeacherDashboardData {
  teacher: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  summary: {
    totalClasses: number;
    totalStudents: number;
    assessmentsConducted: number;
    weakConceptsRate: number; // percentage
  };
  performanceTrend: {
    data: DashboardTrendPoint[];
    overallAvg: number;
    trend: "improving" | "declining" | "stable";
    deltaPct: number;
  };
  classes: DashboardClass[];
  topPerformers: DashboardTopPerformer[];
  pendingWeakConcepts: DashboardWeakConcept[];
  notifications: DashboardNotification[];
}

function getInitials(name: string): string {
  if (!name) return "ST";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "recently";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateShort(dateStr);
  } catch {
    return "recently";
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, name, email, role, avatar_url")
      .eq("id", auth.user.id)
      .maybeSingle();

    const isTeacher =
      profile?.role?.toLowerCase() === "teacher" ||
      auth.user.user_metadata?.role?.toLowerCase() === "teacher";

    if (!isTeacher) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Teacher access required." } },
        { status: 403 }
      );
    }

    const teacherName = profile?.name || auth.user.user_metadata?.name || "Teacher";
    const teacherEmail = profile?.email || auth.user.email || "";
    const teacherAvatar = profile?.avatar_url || null;

    // 1. Fetch teacher classes
    const { data: teacherClassesData, error: classesError } = await admin
      .from("classes")
      .select("id, name, subject, grade, code, created_at")
      .eq("teacher_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (classesError) {
      console.error("Dashboard error fetching classes:", classesError);
    }

    const teacherClasses = teacherClassesData ?? [];
    const classIds = teacherClasses.map((c) => c.id);
    const classMap = new Map<string, { id: string; name: string; subject: string | null; grade: string | null; code: string }>(
      teacherClasses.map((c) => [c.id, {
        id: c.id,
        name: c.name ? c.name.replace(/^"|"$/g, "") : "Class",
        subject: c.subject || null,
        grade: c.grade || null,
        code: c.code,
      }])
    );

    // 2. Fetch class members
    let classMembers: { class_id: string; student_id: string; joined_at: string }[] = [];
    if (classIds.length > 0) {
      const { data: cm, error: cmError } = await admin
        .from("class_members")
        .select("class_id, student_id, joined_at")
        .in("class_id", classIds);
      if (cmError) console.error("Dashboard error fetching class_members:", cmError);
      classMembers = cm ?? [];
    }

    const studentIdsPerClass = new Map<string, Set<string>>();
    const allStudentIdsSet = new Set<string>();
    const studentToPrimaryClassMap = new Map<string, string>();

    for (const m of classMembers) {
      if (!studentIdsPerClass.has(m.class_id)) {
        studentIdsPerClass.set(m.class_id, new Set());
      }
      studentIdsPerClass.get(m.class_id)!.add(m.student_id);
      allStudentIdsSet.add(m.student_id);

      if (!studentToPrimaryClassMap.has(m.student_id)) {
        const cls = classMap.get(m.class_id);
        if (cls) studentToPrimaryClassMap.set(m.student_id, cls.name);
      }
    }

    const allStudentIds = [...allStudentIdsSet];

    // 3. Fetch student profiles
    const studentProfilesMap = new Map<string, { name: string; avatar_url: string | null }>();
    if (allStudentIds.length > 0) {
      const { data: profilesData } = await admin
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", allStudentIds);
      for (const p of profilesData ?? []) {
        studentProfilesMap.set(p.id, { name: p.name, avatar_url: p.avatar_url });
      }
    }

    // 4. Fetch assessments for teacher
    let assessmentsQuery = admin
      .from("assessments")
      .select("id, class_id, title, topic, status, created_at, opens_at, closes_at, ai_insights")
      .order("created_at", { ascending: false });

    if (classIds.length > 0) {
      assessmentsQuery = assessmentsQuery.or(
        `created_by.eq.${auth.user.id},class_id.in.(${classIds.join(",")})`
      );
    } else {
      assessmentsQuery = assessmentsQuery.eq("created_by", auth.user.id);
    }

    const { data: assessmentsData, error: assessmentsError } = await assessmentsQuery;
    if (assessmentsError) {
      console.error("Dashboard error fetching assessments:", assessmentsError);
    }

    const assessmentsList = assessmentsData ?? [];
    const assessmentIds = assessmentsList.map((a) => a.id);
    const assessmentMap = new Map(assessmentsList.map((a) => [a.id, a]));

    // 5. Fetch attempts for these assessments (submitted only)
    let submittedAttempts: {
      id: string;
      assessment_id: string;
      student_id: string;
      score: number | null;
      total: number | null;
      started_at: string;
      submitted_at: string | null;
    }[] = [];

    if (assessmentIds.length > 0) {
      const { data: attData, error: attError } = await admin
        .from("attempts")
        .select("id, assessment_id, student_id, score, total, started_at, submitted_at")
        .in("assessment_id", assessmentIds)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: true });

      if (attError) console.error("Dashboard error fetching attempts:", attError);
      submittedAttempts = attData ?? [];
    }

    // Map attempts per assessment
    const attemptsByAssessmentId = new Map<string, typeof submittedAttempts>();
    // Latest attempt per student per assessment
    const latestAttemptByStudentAssessment = new Map<string, (typeof submittedAttempts)[0]>();

    for (const att of submittedAttempts) {
      if (!attemptsByAssessmentId.has(att.assessment_id)) {
        attemptsByAssessmentId.set(att.assessment_id, []);
      }
      attemptsByAssessmentId.get(att.assessment_id)!.push(att);

      const key = `${att.student_id}:${att.assessment_id}`;
      const existing = latestAttemptByStudentAssessment.get(key);
      if (!existing || new Date(att.submitted_at || 0) > new Date(existing.submitted_at || 0)) {
        latestAttemptByStudentAssessment.set(key, att);
      }
    }

    // 6. Fetch concept performance for completed attempts
    const attemptIds = submittedAttempts.map((a) => a.id);
    let conceptPerfs: {
      attempt_id: string;
      concept: string;
      correct_count: number;
      total_count: number;
      accuracy: number;
      level: string | null;
    }[] = [];

    if (attemptIds.length > 0) {
      const { data: cpData, error: cpError } = await admin
        .from("concept_perf")
        .select("attempt_id, concept, correct_count, total_count, accuracy, level")
        .in("attempt_id", attemptIds);

      if (cpError) console.error("Dashboard error fetching concept_perf:", cpError);
      conceptPerfs = cpData ?? [];
    }

    // Map attempt to student and assessment
    const attemptMetaMap = new Map<string, { studentId: string; assessmentId: string; submittedAt: string | null }>();
    for (const att of submittedAttempts) {
      attemptMetaMap.set(att.id, {
        studentId: att.student_id,
        assessmentId: att.assessment_id,
        submittedAt: att.submitted_at,
      });
    }

    // ─── Calculations ─────────────────────────────────────────────────────────

    // Summary Card 1: Total Classes
    const totalClasses = teacherClasses.length;

    // Summary Card 2: Total Students across assigned classes
    const totalStudents = allStudentIds.length;

    // Summary Card 3: Assessments Conducted (published assessments with at least 1 submission, or published completed)
    const assessmentsWithSubmissions = new Set<string>();
    for (const att of submittedAttempts) {
      assessmentsWithSubmissions.add(att.assessment_id);
    }
    const assessmentsConducted = assessmentsList.filter(
      (a) => a.status === "published" && (assessmentsWithSubmissions.has(a.id) || a.closes_at)
    ).length;

    // Summary Card 4: Weak Concepts Rate
    // Group concept perfs by concept across attempts
    const conceptTotals = new Map<string, { correct: number; total: number; weakCount: number; studentWeakSet: Set<string> }>();
    for (const cp of conceptPerfs) {
      const meta = attemptMetaMap.get(cp.attempt_id);
      if (!conceptTotals.has(cp.concept)) {
        conceptTotals.set(cp.concept, { correct: 0, total: 0, weakCount: 0, studentWeakSet: new Set() });
      }
      const entry = conceptTotals.get(cp.concept)!;
      entry.correct += cp.correct_count;
      entry.total += cp.total_count;
      if (cp.level === "Weak" || (cp.total_count > 0 && cp.correct_count / cp.total_count < 0.5)) {
        entry.weakCount++;
        if (meta?.studentId) entry.studentWeakSet.add(meta.studentId);
      }
    }

    let weakConceptsCount = 0;
    const totalConceptsEvaluated = conceptTotals.size;
    for (const [, stats] of conceptTotals) {
      if (stats.total > 0 && stats.correct / stats.total < 0.6) {
        weakConceptsCount++;
      } else if (stats.weakCount > 0 && stats.studentWeakSet.size >= 2) {
        weakConceptsCount++;
      }
    }

    const weakConceptsRate = totalConceptsEvaluated > 0
      ? Math.round((weakConceptsCount / totalConceptsEvaluated) * 100)
      : 0;

    // ─── Performance Over Time Trend ───────────────────────────────────────────
    // Build chronologically ordered data points for completed assessments
    const trendPoints: DashboardTrendPoint[] = [];

    // Assessments sorted by creation or earliest submission
    const assessmentsWithResults = assessmentsList
      .filter((a) => (attemptsByAssessmentId.get(a.id) ?? []).length > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const a of assessmentsWithResults) {
      const atts = attemptsByAssessmentId.get(a.id) ?? [];
      const classInfo = a.class_id ? classMap.get(a.class_id) : null;
      const className = classInfo ? classInfo.name : "All Classes";

      let totalPct = 0;
      let count = 0;
      let latestSubDate = a.created_at;

      for (const att of atts) {
        if (att.total && att.total > 0 && att.score !== null) {
          totalPct += (att.score / att.total) * 100;
          count++;
          if (att.submitted_at && new Date(att.submitted_at) > new Date(latestSubDate)) {
            latestSubDate = att.submitted_at;
          }
        }
      }

      if (count > 0) {
        const avgScore = Math.round(totalPct / count);
        trendPoints.push({
          assessmentId: a.id,
          classId: a.class_id || "",
          title: a.title,
          className,
          date: formatDateShort(latestSubDate),
          fullDate: latestSubDate,
          avgScore,
          submissionsCount: count,
        });
      }
    }

    // Calculate trend direction & delta
    let trendDirection: "improving" | "declining" | "stable" = "stable";
    let deltaPct = 0;
    let overallAvg = 0;

    if (trendPoints.length >= 2) {
      const last = trendPoints[trendPoints.length - 1].avgScore;
      const prev = trendPoints[trendPoints.length - 2].avgScore;
      deltaPct = last - prev;
      if (deltaPct > 1) trendDirection = "improving";
      else if (deltaPct < -1) trendDirection = "declining";
      else trendDirection = "stable";

      const totalScoreSum = trendPoints.reduce((sum, p) => sum + p.avgScore, 0);
      overallAvg = Math.round(totalScoreSum / trendPoints.length);
    } else if (trendPoints.length === 1) {
      overallAvg = trendPoints[0].avgScore;
    }

    // ─── My Classes Cards ──────────────────────────────────────────────────────
    const dashboardClasses: DashboardClass[] = teacherClasses.map((c) => {
      const studentCount = studentIdsPerClass.get(c.id)?.size ?? 0;
      // Assessments conducted for this class
      const classAssessments = assessmentsList.filter((a) => a.class_id === c.id);
      const conductedCount = classAssessments.filter(
        (a) => a.status === "published" && (attemptsByAssessmentId.get(a.id) ?? []).length > 0
      ).length;

      // Class average score from attempts
      const classAssessmentIds = new Set(classAssessments.map((a) => a.id));
      let classScoreSum = 0;
      let classAttemptCount = 0;

      for (const att of submittedAttempts) {
        if (classAssessmentIds.has(att.assessment_id) && att.total && att.total > 0 && att.score !== null) {
          classScoreSum += (att.score / att.total) * 100;
          classAttemptCount++;
        }
      }

      const avgPerformance = classAttemptCount > 0 ? Math.round(classScoreSum / classAttemptCount) : null;

      return {
        id: c.id,
        name: c.name ? c.name.replace(/^"|"$/g, "") : "Class",
        subject: c.subject || null,
        grade: c.grade || null,
        code: c.code,
        studentCount,
        assessmentCount: conductedCount > 0 ? conductedCount : classAssessments.length,
        avgPerformance,
      };
    });

    // ─── Top Performers ────────────────────────────────────────────────────────
    // Calculate performance per student across all submitted attempts
    const studentPerformanceMap = new Map<string, { totalPct: number; count: number }>();
    for (const att of submittedAttempts) {
      if (att.total && att.total > 0 && att.score !== null) {
        const pct = (att.score / att.total) * 100;
        if (!studentPerformanceMap.has(att.student_id)) {
          studentPerformanceMap.set(att.student_id, { totalPct: 0, count: 0 });
        }
        const s = studentPerformanceMap.get(att.student_id)!;
        s.totalPct += pct;
        s.count++;
      }
    }

    const performersList: DashboardTopPerformer[] = [];
    for (const [studentId, stats] of studentPerformanceMap.entries()) {
      const avgScore = Math.round(stats.totalPct / stats.count);
      const profileInfo = studentProfilesMap.get(studentId);
      const studentName = profileInfo?.name || "Student";
      const studentAvatar = profileInfo?.avatar_url || null;
      const className = studentToPrimaryClassMap.get(studentId) || "Class";

      performersList.push({
        studentId,
        name: studentName,
        avatarUrl: studentAvatar,
        initials: getInitials(studentName),
        className,
        avgScore,
        assessmentsCount: stats.count,
        rank: 0, // will assign after sorting
      });
    }

    // Sort descending by avgScore, then by assessmentsCount
    performersList.sort((a, b) => b.avgScore - a.avgScore || b.assessmentsCount - a.assessmentsCount);

    const topPerformers = performersList.slice(0, 5).map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

    // ─── Pending Weak Concepts ─────────────────────────────────────────────────
    // Identify concepts that need teacher attention from assessment results
    // Find latest concept accuracy per student to see who currently needs improvement
    const studentConceptLatestAccuracy = new Map<string, { accuracy: number; level: string; assessmentId: string; submittedAt: string }>();

    for (const cp of conceptPerfs) {
      const meta = attemptMetaMap.get(cp.attempt_id);
      if (!meta?.studentId) continue;

      const key = `${meta.studentId}:${cp.concept}`;
      const existing = studentConceptLatestAccuracy.get(key);
      const submittedAt = meta.submittedAt || "";

      if (!existing || new Date(submittedAt) > new Date(existing.submittedAt)) {
        const accuracy = cp.total_count > 0 ? cp.correct_count / cp.total_count : cp.accuracy;
        studentConceptLatestAccuracy.set(key, {
          accuracy,
          level: cp.level || (accuracy < 0.5 ? "Weak" : accuracy < 0.8 ? "Medium" : "Strong"),
          assessmentId: meta.assessmentId,
          submittedAt,
        });
      }
    }

    // Group by concept: count students whose latest performance is Weak (< 50% or level === 'Weak')
    const pendingWeakConceptMap = new Map<string, {
      studentCount: number;
      latestAssessmentId: string | null;
    }>();

    for (const [key, data] of studentConceptLatestAccuracy.entries()) {
      if (data.level === "Weak" || data.accuracy < 0.5) {
        const concept = key.split(":")[1];
        if (!pendingWeakConceptMap.has(concept)) {
          pendingWeakConceptMap.set(concept, {
            studentCount: 0,
            latestAssessmentId: data.assessmentId,
          });
        }
        const item = pendingWeakConceptMap.get(concept)!;
        item.studentCount++;
        item.latestAssessmentId = data.assessmentId;
      }
    }

    const pendingWeakConcepts: DashboardWeakConcept[] = [];
    for (const [concept, item] of pendingWeakConceptMap.entries()) {
      if (item.studentCount > 0) {
        const assessment = item.latestAssessmentId ? assessmentMap.get(item.latestAssessmentId) : null;
        const classInfo = assessment?.class_id ? classMap.get(assessment.class_id) : null;

        let priority: "high" | "medium" | "low" = "low";
        if (item.studentCount >= 15 || item.studentCount >= totalStudents * 0.3) {
          priority = "high";
        } else if (item.studentCount >= 6) {
          priority = "medium";
        }

        pendingWeakConcepts.push({
          concept,
          studentCount: item.studentCount,
          priority,
          assessmentId: item.latestAssessmentId,
          assessmentTitle: assessment?.title || null,
          className: classInfo?.name || null,
        });
      }
    }

    // Sort pending weak concepts descending by student count
    pendingWeakConcepts.sort((a, b) => b.studentCount - a.studentCount);

    // ─── Important Notifications ───────────────────────────────────────────────
    // Derived from real system events:
    // 1. Completed assessments
    // 2. Results available
    const notifications: DashboardNotification[] = [];

    // 1. Check completed assessments (e.g. where all enrolled students finished or high participation)
    for (const a of assessmentsList) {
      if (a.status !== "published") continue;
      const atts = attemptsByAssessmentId.get(a.id) ?? [];
      const classInfo = a.class_id ? classMap.get(a.class_id) : null;
      const className = classInfo ? classInfo.name : "Class";
      const totalEnrolled = a.class_id ? (studentIdsPerClass.get(a.class_id)?.size ?? 0) : 0;

      if (atts.length > 0) {
        // Is completed (closed or high completion)
        const isCompleted = (totalEnrolled > 0 && atts.length >= totalEnrolled) ||
          (a.closes_at && new Date(a.closes_at).getTime() < Date.now());

        if (isCompleted) {
          notifications.push({
            id: `notif-comp-${a.id}`,
            type: "assessment_completed",
            title: `${a.title} — ${className} has been completed.`,
            description: `All ${atts.length} student submissions have been recorded and finalized.`,
            timestamp: formatRelativeTime(a.closes_at || a.created_at),
            actionUrl: `/teacher/results/${a.id}`,
            priority: "medium",
          });
        }

        // Results available notification
        let scoreSum = 0;
        for (const att of atts) {
          if (att.total && att.total > 0 && att.score !== null) {
            scoreSum += (att.score / att.total) * 100;
          }
        }
        const avg = atts.length > 0 ? Math.round(scoreSum / atts.length) : 0;

        notifications.push({
          id: `notif-res-${a.id}`,
          type: "results_available",
          title: `${a.title} results are now available.`,
          description: `${atts.length} student${atts.length !== 1 ? "s" : ""} evaluated · Average score ${avg}%`,
          timestamp: formatRelativeTime(atts[atts.length - 1]?.submitted_at || a.created_at),
          actionUrl: `/teacher/results/${a.id}`,
          priority: "medium",
        });
      }
    }

    // Deduplicate & keep top 5 most relevant notifications
    const uniqueNotifications: DashboardNotification[] = [];
    const seenTitles = new Set<string>();
    for (const n of notifications) {
      if (!seenTitles.has(n.title)) {
        seenTitles.add(n.title);
        uniqueNotifications.push(n);
      }
    }

    // Priority order: high -> medium -> low
    uniqueNotifications.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    const finalNotifications = uniqueNotifications.slice(0, 5);

    const responseData: TeacherDashboardData = {
      teacher: {
        id: auth.user.id,
        name: teacherName,
        email: teacherEmail,
        avatarUrl: teacherAvatar,
      },
      summary: {
        totalClasses,
        totalStudents,
        assessmentsConducted,
        weakConceptsRate,
      },
      performanceTrend: {
        data: trendPoints,
        overallAvg,
        trend: trendDirection,
        deltaPct,
      },
      classes: dashboardClasses,
      topPerformers,
      pendingWeakConcepts: pendingWeakConcepts.slice(0, 8),
      notifications: finalNotifications,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("GET /api/teacher/dashboard unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load teacher dashboard data." } },
      { status: 500 }
    );
  }
}
