"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowRight, BookOpen, Check, LineChart, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [selectedRole, setSelectedRole] = useState<"student">("student");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFieldErrors: typeof fieldErrors = {};
    if (!form.name.trim()) nextFieldErrors.name = "Name is required";
    if (!form.email.trim()) nextFieldErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) nextFieldErrors.email = "Enter a valid email";
    if (!form.password) nextFieldErrors.password = "Password is required";
    else if (form.password.length < 8) nextFieldErrors.password = "Password must be at least 8 characters";

    setFieldErrors(nextFieldErrors);
    setLoading(true);
    setError("");

    if (Object.keys(nextFieldErrors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "student" }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to create account.");
        return;
      }

      router.push("/login");
    } catch {
      setError("Unable to create the account right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-white">
      <section className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 lg:flex">
        <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/4 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 -translate-x-1/3 translate-y-1/4 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm"><LineChart className="h-5 w-5" /></span>
            <span className="text-lg font-bold tracking-tight">AssessAI</span>
          </Link>
          <div className="max-w-md">
            <h1 className="mb-4 text-4xl font-bold leading-tight">Assessment that teaches you something.</h1>
            <p className="mb-8 text-lg text-teal-100">Upload materials, generate AI assessments, and get concept-level insights that actually help students learn.</p>
            <div className="space-y-3">
              {["AI-generated assessments from your materials", "Concept-level performance analytics", "Learning gap detection & teaching insights"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15"><Check className="h-3 w-3" /></span>
                  <span className="text-sm text-teal-50">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-teal-200/60">© 2025 AssessAI. Smart Assessment Platform.</p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white"><LineChart className="h-5 w-5" /></span>
            <span className="text-lg font-bold text-slate-900">AssessAI</span>
          </Link>
          <div className="mb-8">
            <h2 className="mb-1 text-2xl font-bold text-slate-900">Create your account</h2>
            <p className="text-sm text-slate-500">Get started with AssessAI in seconds</p>
          </div>
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-slate-700">I am a...</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole("student")}
                className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 border-teal-500 bg-teal-50 p-3 shadow-[0_0_0_3px_rgba(20,184,166,0.15)] transition-all")}
                aria-pressed={selectedRole === "student"}
              >
                <BookOpen className="h-5 w-5 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700">Student</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Take assessments & view results</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input label="Full Name" name="name" placeholder="Enter your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={fieldErrors.name} autoComplete="name" />
            <Input label="Email" name="email" type="email" placeholder="you@school.edu" icon={<Mail className="h-4 w-4" />} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} error={fieldErrors.email} autoComplete="email" />
            <Input label="Password" name="password" type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} error={fieldErrors.password} autoComplete="new-password" />
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" loading={loading} className="w-full">Create Account <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">Sign in</Link></p>
          <p className="mt-6 text-center text-[10px] text-slate-400">By continuing, you agree to AssessAI&apos;s Terms of Service and Privacy Policy.</p>
        </div>
      </section>
    </main>
  );
}
