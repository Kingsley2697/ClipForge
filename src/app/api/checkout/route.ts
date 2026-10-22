import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createFlutterwaveCheckout, PLANS } from "@/lib/flutterwave";
import { prisma } from "@/lib/prisma";

const schema = z.object({ plan: z.enum(["BASIC", "PRO"]) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to choose a plan." }, { status: 401 });

  try {
    const { plan } = schema.parse(await request.json());
    const selectedPlan = PLANS[plan];
    const transactionRef = `clipforge_${user.id}_${randomUUID()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    await prisma.payment.create({
      data: {
        userId: user.id,
        transactionRef,
        plan,
        amount: selectedPlan.amount,
        currency: selectedPlan.currency,
      },
    });

    const checkoutUrl = await createFlutterwaveCheckout({
      txRef: transactionRef,
      email: user.email,
      plan,
      redirectUrl: `${appUrl}/pricing?checkout=complete`,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a valid subscription plan." }, { status: 422 });
    }
    console.error("[POST /api/checkout]", error);
    return NextResponse.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
