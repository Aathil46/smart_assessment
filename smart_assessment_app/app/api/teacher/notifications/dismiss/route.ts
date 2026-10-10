import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const dismissSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required."),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Please log in." } },
        { status: 401 }
      );
    }

    const payload = dismissSchema.parse(await request.json());
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

    const currentList: string[] = Array.isArray((profile as any).dismissed_notifications)
      ? (profile as any).dismissed_notifications
      : [];

    if (!currentList.includes(payload.notificationId)) {
      const updatedList = [...currentList, payload.notificationId];
      const { error: updateError } = await admin
        .from("profiles")
        .update({ dismissed_notifications: updatedList })
        .eq("id", auth.user.id);

      if (updateError) {
        // Fallback: try persisting in auth user_metadata if profiles column update failed
        try {
          await admin.auth.admin.updateUserById(auth.user.id, {
            user_metadata: {
              ...(auth.user.user_metadata || {}),
              dismissed_notifications: updatedList,
            },
          });
        } catch {
          // Non-critical fallback
        }
      }
    }

    return NextResponse.json({
      success: true,
      dismissedId: payload.notificationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid request." } },
        { status: 400 }
      );
    }
    console.error("[Teacher Notifications Dismiss] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to dismiss notification." } },
      { status: 500 }
    );
  }
}
