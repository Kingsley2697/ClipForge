"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignUp = mode === "sign-up";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 sm:p-9 shadow-2xl shadow-slate-200/70">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/25">
            <Sparkles className="h-4 w-4" />
          </span>
          ClipForge
        </Link>

        <div className="mt-8">
          <p className="text-sm font-medium text-violet-700">Welcome {isSignUp ? "to ClipForge" : "back"}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {isSignUp ? "Start creating smarter clips." : "Sign in to your workspace."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {isSignUp ? "Create your account to save projects and manage your plan." : "Enter your details to continue creating and publishing."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" />
            </span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <span className="relative mt-2 block">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input required minLength={isSignUp ? 8 : undefined} type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? "At least 8 characters" : "Your password"} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" />
            </span>
          </label>

          {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">{error}</p>}

          <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isSignUp ? "Create account" : "Sign in"}<ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignUp ? "Already have an account?" : "New to ClipForge?"}{" "}
          <Link className="font-semibold text-violet-700 hover:text-violet-900" href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
