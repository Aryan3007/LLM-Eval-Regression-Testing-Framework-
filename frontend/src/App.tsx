import { ApiStatus } from '@/features/health/components/ApiStatus';

export function App() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
      <header>
        <p className="font-mono text-sm text-stone-500">llmeval</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Catch quality regressions in LLM apps before they ship.
        </h1>
        <p className="mt-3 max-w-prose text-stone-600">
          Run history, score trends and case drill-downs will live here. For now this page only
          checks that the dashboard can talk to the API.
        </p>
      </header>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <ApiStatus />
      </div>
    </main>
  );
}
