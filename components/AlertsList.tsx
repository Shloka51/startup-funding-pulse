import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { Alert, AlertKind } from "@/lib/alerts";

const KIND: Record<AlertKind, { label: string; cls: string; icon: React.ReactNode }> = {
  watchlist: {
    label: "Watchlist",
    cls: "text-watch bg-watch-soft",
    icon: <path d="M8 3C4.4 3 1.7 5.3.6 8c1.1 2.7 3.8 5 7.4 5s6.3-2.3 7.4-5C14.3 5.3 11.6 3 8 3Zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />,
  },
  adjacent: {
    label: "Adjacency",
    cls: "text-watch bg-watch-soft",
    icon: <path d="M5 4a3 3 0 1 0 0 6h1V8.5H5a1.5 1.5 0 1 1 0-3h3V4H5Zm6 0h-1v1.5h1a1.5 1.5 0 1 1 0 3H8V10h3a3 3 0 1 0 0-6ZM5.5 6.25h5v1.5h-5z" />,
  },
  mandate: {
    label: "Mandate",
    cls: "text-accent bg-accent-soft",
    icon: <path d="M8 1.5 9.9 5.4l4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.5Z" />,
  },
  "new-investor": {
    label: "New investor",
    cls: "text-good bg-good-soft",
    icon: <path d="M8 1.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 8 1.5Z" />,
  },
  investor: {
    label: "Investor",
    cls: "text-muted bg-surface-3",
    icon: <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6.5C2.5 11.5 5 10 8 10s5.5 1.5 5.5 4.5h-11Z" />,
  },
};

/** Priority alerts. Each states why it matters and links to the supporting deal or investor. */
export default function AlertsList({ alerts, limit, emptyText }: { alerts: Alert[]; limit?: number; emptyText?: string }) {
  const shown = limit ? alerts.slice(0, limit) : alerts;
  if (shown.length === 0) {
    return <EmptyState title="No priority alerts" compact>{emptyText ?? "Nothing this week touched your watchlist or full mandate."}</EmptyState>;
  }
  return (
    <ul className="divide-y divide-line">
      {shown.map((a) => {
        const k = KIND[a.kind];
        return (
          <li key={a.id}>
            <Link href={a.href} className="group flex gap-3 px-4 py-3 transition hover:bg-surface-2">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded ${k.cls}`} aria-hidden>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">{k.icon}</svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-medium text-ink group-hover:text-accent">{a.title}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">{k.label}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{a.why}</span>
              </span>
              <span aria-hidden className="self-center text-faint group-hover:text-accent">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
