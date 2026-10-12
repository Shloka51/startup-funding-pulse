"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/deals", label: "Deals" },
  { href: "/insights", label: "Insights" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/settings", label: "Settings" },
];

/** Primary tabs. The current page is highlighted and marked aria-current. */
export default function NavLinks({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="scroll-quiet -mb-px flex gap-1 overflow-x-auto">
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const badge = badges[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${
              active ? "border-accent text-ink" : "border-transparent text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {label}
            {badge ? (
              <span className="rounded bg-watch-soft px-1.5 text-[11px] font-semibold tabular-nums text-watch">{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
