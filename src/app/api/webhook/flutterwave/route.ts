import { NextResponse } from "next/server";
import { PLANS, verifyFlutterwaveTransaction } from "@/lib/flutterwave";
import { prisma } from "@/lib/prisma";

type FlutterwaveWebhook = {
  data?: { id?: number | string; tx_ref?: string; status?: string };
};

export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");
  const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!webhookHash || signature !== webhookHash) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const event = (await request.json()) as FlutterwaveWebhook;
    const transactionId = event.data?.id;
    const transactionRef = event.data?.tx_ref;
    if (!transactionId || !transactionRef) {
      return NextResponse.json({ received: true });
    }

    const payment = await prisma.payment.findUnique({ where: { transactionRef } });
    if (!payment) return NextResponse.json({ received: true });

    const verification = await verifyFlutterwaveTransaction(transactionId);
    const transaction = verification.data as {
      id: number | string;
      tx_ref: string;
      status: string;
      amount: number;
      currency: string;
    };
    const expectedPlan = PLANS[payment.plan as keyof typeof PLANS];

    if (
      !expectedPlan ||
      transaction.status !== "successful" ||
      transaction.tx_ref !== payment.transactionRef ||
      Number(transaction.amount) !== payment.amount ||
      transaction.currency !== payment.currency
    ) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return NextResponse.json({ received: true });
    }

    const user = await prisma.user.findUnique({ where: { id: payment.userId } });
    const baseline = user?.subscriptionEndsAt && user.subscriptionEndsAt > new Date()
      ? user.subscriptionEndsAt
      : new Date();
    const subscriptionEndsAt = new Date(baseline);
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "successful", providerPaymentId: String(transaction.id) },
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: { subscriptionPlan: payment.plan, subscriptionStatus: "active", subscriptionEndsAt },
      }),
    ]);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[POST /api/webhook/flutterwave]", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
