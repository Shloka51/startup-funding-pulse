export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading digest">
      <div className="h-3 w-48 rounded bg-surface-2" />
      <div className="h-8 w-72 rounded bg-surface-2" />
      <div className="h-16 rounded-xl bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-xl bg-surface-2" />
        <div className="h-32 rounded-xl bg-surface-2" />
      </div>
      <div className="h-36 rounded-xl bg-surface-2" />
      <div className="h-36 rounded-xl bg-surface-2" />
    </div>
  );
}
