import { NextResponse } from "next/server";

import { requirePrincipalSession } from "@/lib/auth/principal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requirePrincipalSession();

    if (!profile.school_id) {
      return NextResponse.json({ error: { message: "Principal is not assigned to a school." } }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch the school name
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("name")
      .eq("id", profile.school_id)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: { message: "School not found." } }, { status: 404 });
    }

    // Fetch distinct grades from the school's classes
    // Because of RLS, the principal can only see classes in their school.
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("grade");

    if (classesError) {
      return NextResponse.json({ error: { message: "Error fetching grades." } }, { status: 500 });
    }

    const grades = Array.from(new Set(classes.map((c: any) => c.grade).filter(Boolean))).sort();

    return NextResponse.json({
      schoolName: school.name,
      grades,
    });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
