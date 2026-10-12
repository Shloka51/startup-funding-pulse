"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <p className="text-[15px] font-semibold">This view couldn&apos;t load</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted">
        Something went wrong while rendering. Your settings and saved briefs are safe.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={reset} className="rounded-md bg-accent-strong px-3.5 py-2 text-xs font-medium text-on-accent">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-line px-3.5 py-2 text-xs font-medium text-muted hover:text-ink">
          Overview
        </Link>
      </div>
    </div>
  );
}
