import Link from "next/link";

export default function StudentNavigationPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">AI Smart Assessment</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Student Navigation</h1>
        <p className="mt-2 text-slate-600">Quick access to your student workflow.</p>
      </header>
      <section className="grid gap-5 sm:grid-cols-2">
        <Link href="/student" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md">
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-2 text-sm text-slate-600">Join classes and see available assessments.</p>
        </Link>
        <Link href="/student" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md">
          <h2 className="text-xl font-semibold text-slate-900">Assessments</h2>
          <p className="mt-2 text-sm text-slate-600">Open an available assessment and submit your answers.</p>
        </Link>
      </section>
    </main>
  );
}
