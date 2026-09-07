/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>();
  const [index, setIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId: id }) })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Unable to load the assessment."));
  }, [id]);

  if (!data?.questions) return <main className="p-8">Loading...</main>;
  const question = data.questions[index];

  async function answer(value: string) {
    setSelectedAnswers((current) => ({ ...current, [question.id]: value }));
    const response = await fetch(`/api/attempts/${data.attempt.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, selectedChoice: value }) });
    if (!response.ok) setError("Unable to save this answer.");
  }

  async function submit() {
    const response = await fetch(`/api/attempts/${data.attempt.id}/submit`, { method: "POST" });
    const result = await response.json();
    if (response.ok) router.push(`/student/results/${data.attempt.id}`);
    else setError(result?.error?.message ?? "Unable to submit.");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/student" className="text-sm font-medium text-blue-600 hover:underline">&larr; Back to Dashboard</Link>
      <p className="mt-6 text-sm text-slate-500">Question {index + 1} of {data.questions.length}</p>
      <h1 className="mt-3 text-2xl font-semibold">{question.text}</h1>
      <div className="mt-6 grid gap-3">
        {question.choices.map((choice: string) => {
          const isSelected = selectedAnswers[question.id] === choice;
          return <button key={choice} onClick={() => answer(choice)} aria-pressed={isSelected} className={`rounded-lg border p-4 text-left transition ${isSelected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-300 hover:border-blue-500"}`}>{choice}</button>;
        })}
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      <div className="mt-8 flex justify-between"><button disabled={!index} onClick={() => setIndex(index - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Back</button>{index + 1 === data.questions.length ? <button onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Submit</button> : <button onClick={() => setIndex(index + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Next</button>}</div>
    </main>
  );
}
