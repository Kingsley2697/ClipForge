import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { PLANS, verifyPaystackTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";

type PaystackWebhook = {
  event?: string;
  data?: { id?: number | string; reference?: string; status?: string; amount?: number; currency?: string };
};

function hasValidSignature(payload: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const expected = createHmac("sha512", secret).update(payload).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!hasValidSignature(payload, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const event = JSON.parse(payload) as PaystackWebhook;
    if (event.event !== "charge.success") return NextResponse.json({ received: true });

    const reference = event.data?.reference;
    if (!reference) return NextResponse.json({ received: true });

    const payment = await prisma.payment.findUnique({ where: { transactionRef: reference } });
    if (!payment || payment.status === "successful") return NextResponse.json({ received: true });

    const verification = await verifyPaystackTransaction(reference);
    const transaction = verification.data as {
      id: number | string;
      reference: string;
      status: string;
      amount: number;
      currency: string;
    };
    const expectedPlan = PLANS[payment.plan as keyof typeof PLANS];

    if (
      !expectedPlan ||
      transaction.status !== "success" ||
      transaction.reference !== payment.transactionRef ||
      Number(transaction.amount) !== payment.amount ||
      transaction.currency !== payment.currency
    ) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return NextResponse.json({ received: true });
    }

    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "successful" } },
        data: { status: "successful", providerPaymentId: String(transaction.id) },
      });
      if (result.count === 0) return;

      const user = await tx.user.findUnique({ where: { id: payment.userId } });
      const baseline = user?.subscriptionEndsAt && user.subscriptionEndsAt > new Date()
        ? user.subscriptionEndsAt
        : new Date();
      const subscriptionEndsAt = new Date(baseline);
      subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

      await tx.user.update({
        where: { id: payment.userId },
        data: { subscriptionPlan: payment.plan, subscriptionStatus: "active", subscriptionEndsAt },
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[POST /api/webhook/paystack]", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
