"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; grade?: string | null };
type MaterialOption = { id: string; title: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function NewAssessmentPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [form, setForm] = useState({ classId: "", materialId: "", title: "", topic: "", numQuestions: 10, difficulty: "medium" });
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [error, setError] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    const classId = new URLSearchParams(window.location.search).get("classId");
    if (classId && !UUID_PATTERN.test(classId)) {
      setError("The selected class link is invalid. Please choose a class again.");
      setLoadingClasses(false);
      return;
    }

    fetch("/api/classes")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load your classes.");
        return response.json();
      })
      .then((data) => {
        const availableClasses = (data.classes ?? []) as ClassOption[];
        setClasses(availableClasses);
        const matchingClass = classId ? availableClasses.find((item) => item.id === classId) : null;
        if (classId && !matchingClass) {
          setError("That class was not found or is not available to you. Please choose another class.");
          return;
        }
        if (matchingClass) {
          setSelectedClass(matchingClass);
          setForm((current) => ({ ...current, classId: matchingClass.id }));
        }
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load your classes."))
      .finally(() => setLoadingClasses(false));
  }, []);

  useEffect(() => {
    if (!form.classId) {
      setMaterials([]);
      return;
    }
    fetch(`/api/materials?classId=${encodeURIComponent(form.classId)}`)
      .then((response) => response.json())
      .then((data) => setMaterials(data.materials ?? []))
      .catch(() => setError("Unable to load materials for this class."));
  }, [form.classId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.classId || !UUID_PATTERN.test(form.classId) || !selectedClass) {
      setError("Please select a valid class before creating the assessment.");
      return;
    }
    const response = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: form.classId }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data?.error?.message ?? "Unable to create assessment.");
    const generated = await fetch(`/api/assessments/${data.id}/generate`, { method: "POST" });
    if (!generated.ok) {
      const failure = await generated.json();
      return setError(failure?.error?.message ?? "Generation failed.");
    }
    router.push(`/teacher/assessments/${data.id}/edit`);
  }

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId) ?? null;
    setSelectedClass(nextClass);
    setForm((current) => ({ ...current, classId, materialId: "" }));
    setError(nextClass ? "" : "Please select a valid class.");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Create assessment</h1>
        <Link href={selectedClass ? `/teacher/classes/${selectedClass.id}` : "/teacher/classes"} className="text-sm font-medium text-blue-600 hover:underline">Back to class</Link>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="class">Class</label>
          {selectedClass ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-slate-800">{selectedClass.name}{selectedClass.grade ? ` · Grade ${selectedClass.grade}` : ""}</div>
          ) : (
            <select id="class" className="w-full rounded-lg border p-3" value={form.classId} onChange={(event) => chooseClass(event.target.value)} required disabled={loadingClasses}>
              <option value="">{loadingClasses ? "Loading classes..." : "Select a class"}</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? ` · Grade ${item.grade}` : ""}</option>)}
            </select>
          )}
        </div>
        <select className="w-full rounded-lg border p-3" value={form.materialId} onChange={(event) => setForm({ ...form, materialId: event.target.value })} required disabled={!selectedClass}><option value="">Select processed material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        <input className="w-full rounded-lg border p-3" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <input className="w-full rounded-lg border p-3" placeholder="Topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required />
        <label className="block">Questions (3-20)<input className="mt-1 w-full rounded-lg border p-3" type="number" min={3} max={20} value={form.numQuestions} onChange={(event) => setForm({ ...form, numQuestions: Number(event.target.value) })} /></label>
        <select className="w-full rounded-lg border p-3" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option>easy</option><option>medium</option><option>hard</option></select>
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        <button className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white" disabled={loadingClasses || !selectedClass}>Generate draft questions</button>
      </form>
    </main>
  );
}