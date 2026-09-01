"use client";

import { useRef, useState } from "react";
import { use } from "react";

export default function TeacherMaterialsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("classId", classId);
    formData.append("title", title || file.name);

    try {
      setUploading(true);
      setError("");
      setStatus("Uploading PDF...");

      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to upload material.");
        setStatus(null);
        return;
      }

      setStatus(`Uploaded: ${payload.title ?? file.name}`);
      setTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setError("Upload failed. Please try again.");
      setStatus(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Upload learning material</h1>
        <p className="mt-2 text-slate-600">Upload a PDF for this class. The backend will extract text and mark the material ready or failed.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="title">
              Material title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Quadratic Equations"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="file">
              PDF file
            </label>
            <input
              id="file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </div>

          {status ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{status}</div> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {uploading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>
      </div>
    </main>
  );
}
