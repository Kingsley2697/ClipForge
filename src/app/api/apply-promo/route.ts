import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().trim().min(1).max(100),
  planType: z.enum(["BASIC", "PRO"]),
});

function getPromoCodes() {
  const configuredCodes = process.env.PROMO_CODES || "VIPFRIEND,FOUNDER100";
  return new Set(
    configuredCodes
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Please sign in to apply a promo code." },
      { status: 401 },
    );
  }

  try {
    const { code, planType } = schema.parse(await request.json());
    if (!getPromoCodes().has(code.toUpperCase())) {
      return NextResponse.json({ success: false, message: "Invalid promo code" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { subscriptionEndsAt: true },
      });
      const baseline = currentUser?.subscriptionEndsAt && currentUser.subscriptionEndsAt > now
        ? currentUser.subscriptionEndsAt
        : now;
      const subscriptionEndsAt = new Date(baseline);
      subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

      await tx.user.update({
        where: { id: user.id },
        data: {
          subscriptionPlan: planType,
          subscriptionStatus: "active",
          subscriptionStartedAt: new Date(baseline),
          subscriptionEndsAt,
        },
      });

      await tx.payment.create({
        data: {
          userId: user.id,
          transactionRef: `promo-${user.id}-${randomUUID()}`,
          plan: planType,
          amount: 0,
          currency: "USD",
          provider: "promo",
          status: "successful",
        },
      });
    });

    return NextResponse.json({ success: true, message: "Promo applied successfully!" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Enter a valid promo code and plan." },
        { status: 422 },
      );
    }

    console.error("[POST /api/apply-promo]", error);
    return NextResponse.json(
      { success: false, message: "Unable to apply promo code. Please try again." },
      { status: 500 },
    );
  }
}
