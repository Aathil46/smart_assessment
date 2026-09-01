/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function StudentPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/assessments").then((r) => r.json()).then((d) => setAssessments(d.assessments ?? []));
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/classes/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    setMessage(r.ok ? "Class joined." : (await r.json())?.error?.message ?? "Unable to join.");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">AI Smart Assessment</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Student Dashboard</h1>
          <p className="mt-2 text-slate-600">Join your class and complete available assessments.</p>
        </div>
        <nav className="flex gap-2" aria-label="Student navigation">
          <Link href="/student" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Dashboard</Link>
        </nav>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Join a Class</h2>
        <form onSubmit={join} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input className="flex-1 rounded-lg border border-slate-300 p-3" placeholder="6-character class code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700">Join Class</button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Available Assessments</h2>
        <div className="mt-4 space-y-3">
          {assessments.map((item) => (
            <Link className="block rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50" key={item.id} href={`/student/assessments/${item.id}/take`}>
              <strong>{item.title}</strong><span className="ml-3 text-slate-500">{item.topic}</span>
            </Link>
          ))}
          {!assessments.length && <p className="text-slate-500">No assessments available.</p>}
        </div>
      </section>
    </main>
  );
}
