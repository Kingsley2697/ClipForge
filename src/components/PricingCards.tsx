"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";

const plans = [
  { id: "BASIC", name: "Basic", price: "$15", description: "Everything you need to publish consistently.", features: ["30 videos per month", "All aspect ratios", "Caption-ready exports"], featured: false },
  { id: "PRO", name: "Pro", price: "$25", description: "More output for teams and high-volume creators.", features: ["Unlimited projects", "Priority processing", "Priority support"], featured: true },
] as const;

export function PricingCards() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function beginCheckout(plan: "BASIC" | "PRO") {
    setError("");
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to start checkout.");
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
      {plans.map((plan) => (
        <section key={plan.id} className={`relative rounded-[1.75rem] border p-7 shadow-xl ${plan.featured ? "border-violet-400 bg-violet-50 shadow-violet-200/70" : "border-slate-200 bg-white shadow-slate-200/70"}`}>
          {plan.featured && <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500 px-3 py-1 text-xs font-bold text-white"><Sparkles className="h-3 w-3" /> Most popular</span>}
          <h2 className="text-xl font-bold text-slate-950">{plan.name}</h2>
          <p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{plan.description}</p>
          <div className="mt-6 flex items-end gap-1"><span className="text-5xl font-bold tracking-tight text-slate-950">{plan.price}</span><span className="mb-1 text-sm text-slate-500">/ month</span></div>
          <ul className="my-7 space-y-3 border-y border-slate-200 py-6 text-sm text-slate-700">
            {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-600" />{feature}</li>)}
          </ul>
          <button onClick={() => beginCheckout(plan.id)} disabled={Boolean(loadingPlan)} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${plan.featured ? "bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-indigo-400" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
            {loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Choose ${plan.name}`}
          </button>
        </section>
      ))}
      {error && <p className="md:col-span-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-700">{error}</p>}
    </div>
  );
}
