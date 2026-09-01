"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewClassPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", subject: "", grade: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to create this class.");
        return;
      }

      router.push(`/teacher/classes/${payload.id}`);
    } catch {
      setError("Unable to create class right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Create a class</h1>
        <p className="mt-2 text-slate-600">Create a class and share the join code with students.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
              Class name
            </label>
            <input
              id="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="grade">
              Grade
            </label>
            <input
              id="grade"
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? "Creating class..." : "Create class"}
          </button>
        </form>
      </div>
    </main>
  );
}
