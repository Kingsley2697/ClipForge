import { Navbar } from "@/components/Navbar";
import { PricingCards } from "@/components/PricingCards";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold text-violet-700">Simple monthly pricing</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Create more from every recording.</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Choose the plan that fits your publishing rhythm. Upgrade or change plans when your needs change.</p>
        </div>
        <PricingCards />
      </main>
    </div>
  );
}
