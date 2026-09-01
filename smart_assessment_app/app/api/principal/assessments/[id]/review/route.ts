import { NextResponse } from "next/server";
import { requirePrincipalSession } from "@/lib/auth/principal";
import { generatePrincipalReview } from "@/lib/gemini/principal";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePrincipalSession();

    const body = await request.json();
    const { passed, failed, weakConcepts } = body;

    if (passed === undefined || failed === undefined || !Array.isArray(weakConcepts)) {
      return NextResponse.json({ error: { message: "Invalid payload." } }, { status: 400 });
    }

    const review = await generatePrincipalReview({
      passed,
      failed,
      weakConcepts,
    });

    if (!review) {
      return NextResponse.json({ error: { message: "AI review generation failed." } }, { status: 500 });
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
  }
}
