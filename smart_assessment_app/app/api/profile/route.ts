import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
  personal_email: z.string().email().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  // Structured address fields
  addr_door: z.string().max(50).nullable().optional(),
  addr_building: z.string().max(100).nullable().optional(),
  addr_street: z.string().max(150).nullable().optional(),
  addr_city: z.string().max(100).nullable().optional(),
  addr_state: z.string().max(100).nullable().optional(),
  addr_pincode: z.string().max(10).nullable().optional(),
  // Student specific fields
  blood_group: z.string().max(20).nullable().optional(),
  grade: z.string().max(50).nullable().optional(),
  section: z.string().max(50).nullable().optional(),
  roll_number: z.string().max(50).nullable().optional(),
  father_name: z.string().max(100).nullable().optional(),
  father_mobile: z.string().max(30).nullable().optional(),
  mother_name: z.string().max(100).nullable().optional(),
  mother_mobile: z.string().max(30).nullable().optional(),
});

const PROFILE_EXTENDED_SELECT =
  "id, email, name, role, school_id, phone, personal_email, date_of_birth, gender, avatar_url, created_at, addr_door, addr_building, addr_street, addr_city, addr_state, addr_pincode, blood_group, grade, section, roll_number, father_name, father_mobile, mother_name, mother_mobile";

const PROFILE_BASE_SELECT =
  "id, email, name, role, school_id, phone, personal_email, date_of_birth, gender, avatar_url, created_at, addr_door, addr_building, addr_street, addr_city, addr_state, addr_pincode";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Attempt to query extended fields, fallback to base fields if 0013 migration hasn't run yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profile: any = null;
    const { data: extProfile, error: extError } = await admin
      .from("profiles")
      .select(PROFILE_EXTENDED_SELECT)
      .eq("id", userData.user.id)
      .single();

    if (extError) {
      // If error is missing column in schema cache, try base select
      const { data: baseProfile, error: baseError } = await admin
        .from("profiles")
        .select(PROFILE_BASE_SELECT)
        .eq("id", userData.user.id)
        .single();

      if (baseError || !baseProfile) {
        throw new Error(baseError?.message ?? extError.message);
      }
      profile = baseProfile;
    } else {
      profile = extProfile;
    }

    if (!profile) {
      throw new Error("Profile not found.");
    }

    // Fetch school if linked
    let school: { id: string; name: string } | null = null;
    if (profile.school_id) {
      const { data: schoolData } = await admin
        .from("schools")
        .select("id, name")
        .eq("id", profile.school_id)
        .single();
      school = schoolData ?? null;
    }

    // Teacher assignments
    let subjects: string[] = [];
    let grades: string[] = [];

    if (profile.role === "teacher") {
      const { data: classes } = await admin
        .from("classes")
        .select("subject, grade")
        .eq("teacher_id", userData.user.id);

      if (classes && classes.length > 0) {
        subjects = [...new Set(classes.map((c) => c.subject).filter(Boolean) as string[])].sort();
        grades = [...new Set(classes.map((c) => c.grade).filter(Boolean) as string[])].sort();
      }
    }

    // Student enrolled class details & fallback school
    let enrolledGrade: string | null = null;
    let enrolledSection: string | null = null;

    if (profile.role === "student") {
      const { data: enrollments } = await admin
        .from("class_members")
        .select("class_id, classes(name, grade, subject, teacher_id)")
        .eq("student_id", userData.user.id);

      if (enrollments && enrollments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstClass = enrollments[0]?.classes as any;
        if (firstClass?.grade) {
          enrolledGrade = firstClass.grade;
        }
        if (firstClass?.name) {
          enrolledSection = firstClass.name;
        }

        // If school wasn't directly linked on the profile, look up via class teacher's school
        if (!school) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const teacherIds = enrollments.map((e: any) => e.classes?.teacher_id).filter(Boolean);
          if (teacherIds.length > 0) {
            const { data: teachers } = await admin
              .from("profiles")
              .select("school_id")
              .in("id", teacherIds)
              .not("school_id", "is", null)
              .limit(1);

            if (teachers && teachers.length > 0 && teachers[0].school_id) {
              const { data: schoolData } = await admin
                .from("schools")
                .select("id, name")
                .eq("id", teachers[0].school_id)
                .single();
              school = schoolData ?? null;
            }
          }
        }
      }
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        phone: profile.phone ?? null,
        personal_email: profile.personal_email ?? null,
        date_of_birth: profile.date_of_birth ?? null,
        gender: profile.gender ?? null,
        avatar_url: profile.avatar_url ?? null,
        created_at: profile.created_at,
        school,
        subjects,
        grades,
        addr_door: profile.addr_door ?? null,
        addr_building: profile.addr_building ?? null,
        addr_street: profile.addr_street ?? null,
        addr_city: profile.addr_city ?? null,
        addr_state: profile.addr_state ?? null,
        addr_pincode: profile.addr_pincode ?? null,
        // Student fields
        blood_group: profile.blood_group ?? null,
        grade: profile.grade ?? enrolledGrade ?? null,
        section: profile.section ?? enrolledSection ?? null,
        roll_number: profile.roll_number ?? null,
        father_name: profile.father_name ?? null,
        father_mobile: profile.father_mobile ?? null,
        mother_name: profile.mother_name ?? null,
        mother_mobile: profile.mother_mobile ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const payload = updateSchema.parse(body);

    // Build update object - only include keys that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    const UPDATABLE: (keyof typeof payload)[] = [
      "name", "phone", "personal_email", "date_of_birth", "gender", "avatar_url",
      "addr_door", "addr_building", "addr_street", "addr_city", "addr_state", "addr_pincode",
      "blood_group", "grade", "section", "roll_number",
      "father_name", "father_mobile", "mother_name", "mother_mobile",
    ];
    for (const key of UPDATABLE) {
      if (payload[key] !== undefined) updates[key] = payload[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, message: "Nothing to update." });
    }

    const admin = createAdminSupabaseClient();

    // Try updating and selecting extended fields; fallback to base fields if migration 0013 pending
    let updated: any = null;
    const { data: extUpdated, error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userData.user.id)
      .select(PROFILE_EXTENDED_SELECT)
      .single();

    if (updateError) {
      // If error is due to a missing column from 0013, try filtering out those columns
      if (updateError.message.includes("column") || updateError.code === "PGRST204") {
        const fallbackUpdates = { ...updates };
        const studentFields = ["blood_group", "grade", "section", "roll_number", "father_name", "father_mobile", "mother_name", "mother_mobile"];
        for (const sf of studentFields) {
          delete fallbackUpdates[sf];
        }

        if (Object.keys(fallbackUpdates).length > 0) {
          const { data: baseUpdated, error: baseErr } = await admin
            .from("profiles")
            .update(fallbackUpdates)
            .eq("id", userData.user.id)
            .select(PROFILE_BASE_SELECT)
            .single();

          if (baseErr) throw new Error(baseErr.message);
          updated = { ...baseUpdated, ...updates };
        } else {
          // If only student fields were updated but migration not run
          throw new Error("Student profile fields migration (0013) has not yet been applied to the database. Please execute supabase/migrations/0013_student_profile_fields.sql in your Supabase SQL editor.");
        }
      } else {
        throw new Error(updateError.message);
      }
    } else {
      updated = extUpdated;
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input." } },
        { status: 400 }
      );
    }
    return NextResponse.json(toErrorResponse(error), { status: 500 });
  }
}
