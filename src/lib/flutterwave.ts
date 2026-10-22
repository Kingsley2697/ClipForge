export const PLANS = {
  BASIC: { id: "BASIC", name: "Basic", amount: 15, currency: "USD" },
  PRO: { id: "PRO", name: "Pro", amount: 25, currency: "USD" },
} as const;

export type PlanId = keyof typeof PLANS;

function getSecretKey() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured.");
  return key;
}

async function flutterwaveFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.flutterwave.com/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || body.status !== "success") {
    throw new Error(body.message || "Flutterwave request failed.");
  }
  return body;
}

export async function createFlutterwaveCheckout(input: {
  txRef: string;
  email: string;
  plan: PlanId;
  redirectUrl: string;
}) {
  const plan = PLANS[input.plan];
  const response = await flutterwaveFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: plan.amount,
      currency: plan.currency,
      redirect_url: input.redirectUrl,
      customer: { email: input.email },
      meta: { plan: plan.id },
      customizations: {
        title: "ClipForge subscription",
        description: `${plan.name} plan — monthly subscription`,
      },
    }),
  });

  return response.data.link as string;
}

export async function verifyFlutterwaveTransaction(transactionId: string | number) {
  return flutterwaveFetch(`/transactions/${transactionId}/verify`);
}
