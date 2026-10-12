"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-lg font-semibold">The brief couldn&apos;t load</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Something went wrong on our side. Your settings and saved digests are safe.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white dark:text-[#0e1014]"
        >
          Try again
        </button>
        <Link href="/settings" className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
          Settings
        </Link>
      </div>
    </div>
  );
}
