import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">AI Smart Assessment</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Teacher-ready assessment workflow</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Sign up
            </Link>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">Project foundation</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              This MVP includes the foundation for teacher authentication, class management, secure material upload,
              PDF extraction, and Gemini-backed content processing with validation and safe server-side boundaries.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">Current milestone</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Next.js App Router + TypeScript foundation</li>
              <li>• Supabase + RLS-ready schema and services</li>
              <li>• Teacher auth pages and protected routing</li>
              <li>• Class creation and material workflow setup</li>
              <li>• PDF extraction and Gemini service boundaries</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
