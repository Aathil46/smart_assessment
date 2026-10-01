"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowRight, BookOpen, Building2, Check, GraduationCap, LineChart, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [selectedRole, setSelectedRole] = useState<"teacher" | "student" | "principal">("teacher");

  const roles = [
    { id: "teacher", label: "Teacher", icon: GraduationCap, desc: "Create assessments & track students" },
    { id: "student", label: "Student", icon: BookOpen, desc: "Take assessments & view results" },
    { id: "principal", label: "Principal", icon: Building2, desc: "Monitor school performance" },
  ] as const;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFieldErrors: typeof fieldErrors = {};
    if (!email.trim()) nextFieldErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextFieldErrors.email = "Enter a valid email";
    if (!password) nextFieldErrors.password = "Password is required";
    else if (password.length < 8) nextFieldErrors.password = "Password must be at least 8 characters";

    setFieldErrors(nextFieldErrors);
    setLoading(true);
    setError("");

    if (Object.keys(nextFieldErrors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "Invalid email or password.");
        return;
      }

      const role: string | null = payload?.role ?? null;

      if (role === "teacher") {
        router.push("/teacher");
      } else if (role === "student") {
        router.push("/student/classes");
      } else if (role === "principal") {
        router.push("/principal");
      } else {
        // Profile missing or unknown role — redirect to a safe fallback.
        setError("Your account does not have an assigned role. Please contact support.");
      }
    } catch {
      setError("Unable to log in right now. Please try again.");
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
            <h2 className="mb-1 text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500">Sign in to your AssessAI account</p>
          </div>
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-slate-700">I am a...</p>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 bg-white p-3 transition-all",
                    selectedRole === role.id
                      ? "border-teal-500 bg-teal-50 shadow-[0_0_0_3px_rgba(20,184,166,0.15)]"
                      : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <role.icon className={cn("h-5 w-5", selectedRole === role.id ? "text-teal-600" : "text-slate-400")} />
                  <span className={cn("text-xs font-semibold", selectedRole === role.id ? "text-teal-700" : "text-slate-600")}>
                    {role.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">{roles.find((role) => role.id === selectedRole)?.desc}</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input label="Email" name="email" type="email" placeholder="you@school.edu" icon={<Mail className="h-4 w-4" />} value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} autoComplete="email" />
            <Input label="Password" name="password" type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} value={password} onChange={(event) => setPassword(event.target.value)} error={fieldErrors.password} autoComplete="current-password" />
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" /><span className="text-xs">Remember me</span></label>
              <Link href="/forgot-password" className="text-xs font-medium text-teal-600 hover:text-teal-700">Forgot password?</Link>
            </div>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" loading={loading} className="w-full">Sign In <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Don&apos;t have an account? <Link href="/signup" className="font-semibold text-teal-600 hover:text-teal-700">Sign up</Link></p>
          <p className="mt-6 text-center text-[10px] text-slate-400">By continuing, you agree to AssessAI&apos;s Terms of Service and Privacy Policy.</p>
        </div>
      </section>
    </main>
  );
}
