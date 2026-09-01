"use client";

import { useState } from "react";

export default function RetryMaterialButton({ materialId }: { materialId: string }) {
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRetry() {
    setProcessing(true);
    setMessage("");

    try {
      const response = await fetch(`/api/materials/${materialId}/retry`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Processing failed. Please try again.");
        return;
      }

      setMessage(payload.status === "processed" ? "Processed successfully." : "Processing complete.");
      window.location.reload();
    } catch {
      setMessage("Processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleRetry}
        disabled={processing}
        className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? "Processing..." : "Retry processing"}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
