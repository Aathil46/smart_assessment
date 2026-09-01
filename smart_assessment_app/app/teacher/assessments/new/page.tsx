"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MaterialOption = { id: string; title: string };

export default function NewAssessmentPage() {
  const router = useRouter();
  const [form, setForm] = useState({ classId: "", materialId: "", title: "", topic: "", numQuestions: 10, difficulty: "medium" });
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const classId = new URLSearchParams(window.location.search).get("classId") ?? form.classId;
    if (!classId) return;
    fetch(`/api/materials?classId=${encodeURIComponent(classId)}`).then((response) => response.json()).then((data) => setMaterials(data.materials ?? []));
  }, [form.classId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const classId = form.classId || new URLSearchParams(window.location.search).get("classId") || "";
    const response = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, classId }) });
    const data = await response.json();
    if (!response.ok) return setError(data?.error?.message ?? "Unable to create assessment.");
    const generated = await fetch(`/api/assessments/${data.id}/generate`, { method: "POST" });
    if (!generated.ok) { const failure = await generated.json(); return setError(failure?.error?.message ?? "Generation failed."); }
    router.push(`/teacher/assessments/${data.id}/edit`);
  }

  return <main className="mx-auto max-w-2xl px-6 py-10"><h1 className="text-3xl font-semibold">Create assessment</h1><form onSubmit={submit} className="mt-8 space-y-4"><input className="w-full rounded-lg border p-3" placeholder="Class ID" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required /><select className="w-full rounded-lg border p-3" value={form.materialId} onChange={(event) => setForm({ ...form, materialId: event.target.value })} required><option value="">Select processed material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input className="w-full rounded-lg border p-3" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /><input className="w-full rounded-lg border p-3" placeholder="Topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required /><label className="block">Questions (3-20)<input className="mt-1 w-full rounded-lg border p-3" type="number" min={3} max={20} value={form.numQuestions} onChange={(event) => setForm({ ...form, numQuestions: Number(event.target.value) })} /></label><select className="w-full rounded-lg border p-3" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option>easy</option><option>medium</option><option>hard</option></select>{error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}<button className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white">Generate draft questions</button></form></main>;
}