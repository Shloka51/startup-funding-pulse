/** Skeleton shown while a page's data loads (digest from cache, or a first-time generation). */
export default function Loading() {
  const bar = "animate-pulse rounded bg-surface-2";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 bg-surface p-4">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-6 w-16`} />
            <div className={`${bar} h-2.5 w-32`} />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <div className={`${bar} h-3.5 w-40`} />
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className={`${bar} h-3`} style={{ width: `${90 - j * 12}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className={`${bar} h-48 rounded-lg`} />
    </div>
  );
}
