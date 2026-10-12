export default function StatusBanner({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={`flex gap-2.5 rounded-md border px-3.5 py-2.5 text-xs ${
        tone === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-surface text-muted"
      }`}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
        {tone === "warn" ? (
          <path d="M8.9 1.6a1 1 0 0 0-1.8 0L.6 13.5A1 1 0 0 0 1.5 15h13a1 1 0 0 0 .9-1.5L8.9 1.6ZM8 5a.8.8 0 0 1 .8.8v3.5a.8.8 0 0 1-1.6 0V5.8A.8.8 0 0 1 8 5Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
        ) : (
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm1 8H7V7.5h2V12Z" />
        )}
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
