export const PLANS = {
  BASIC: { id: "BASIC", name: "Basic", amount: 15, amountInSubunit: 1500, currency: "USD" },
  PRO: { id: "PRO", name: "Pro", amount: 25, amountInSubunit: 2500, currency: "USD" },
} as const;

export type PlanId = keyof typeof PLANS;

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

async function paystackFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || !body.status) {
    throw new Error(body.message || "Paystack request failed.");
  }
  return body;
}

export async function createPaystackCheckout(input: {
  reference: string;
  email: string;
  plan: PlanId;
  callbackUrl: string;
}) {
  const plan = PLANS[input.plan];
  const response = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: String(plan.amountInSubunit),
      currency: plan.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify({ plan: plan.id }),
    }),
  });

  return response.data.authorization_url as string;
}

export async function verifyPaystackTransaction(reference: string) {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}
