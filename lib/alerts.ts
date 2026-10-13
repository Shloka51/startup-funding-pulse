import { formatShortDate } from "@/lib/dates";
import { formatAmount } from "@/lib/format";
import { investorActivity, type NewInvestorRow } from "@/lib/insights";
import type { Deal } from "@/lib/types";

export type AlertKind = "watchlist" | "adjacent" | "mandate" | "new-investor" | "investor";

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  why: string;
  href: string;
  dealId?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function roundLine(d: Deal) {
  const parts = [
    d.stage !== "Undisclosed" ? d.stage : "Round",
    formatAmount(d.amount) !== "Undisclosed" ? formatAmount(d.amount) : "amount undisclosed",
  ];
  const lead = d.leadInvestor !== "Undisclosed" ? `, led by ${d.leadInvestor}` : "";
  return `${parts.join(" · ")}${lead}, reported ${formatShortDate(d.date)}`;
}

/**
 * Priority alerts, most important first. Every alert comes from real deal fields and links
 * to the deal (or investor) it's about:
 *  1. Watchlist companies that raised.
 *  2. Watchlist companies named in someone else's round (as investor or in coverage).
 *  3. Full mandate matches (sector AND stage), biggest first.
 *  4. Investors new to your target sectors (not seen in earlier stored weeks).
 *  5. Investors who backed 2+ deals this week.
 */
export function buildAlerts(
  deals: Deal[],
  {
    mandateLimit = 4,
    investorLimit = 3,
    newInvestors = null as NewInvestorRow[] | null,
    priorWeeks = 0,
    newInvestorLimit = 3,
  } = {}
): Alert[] {
  const alerts: Alert[] = [];

  for (const d of deals.filter((x) => x.watchlistMatch)) {
    const name = d.watchlistMatch!;
    const direct = norm(d.company).includes(norm(name)) || norm(name).includes(norm(d.company));
    if (direct) {
      alerts.push({
        id: `w-${d.id}`,
        kind: "watchlist",
        title: `${d.company} raised funding`,
        why: `On your watchlist. ${roundLine(d)}.`,
        href: `/deals?deal=${encodeURIComponent(d.id)}`,
        dealId: d.id,
      });
    } else {
      const asInvestor = [d.leadInvestor, ...d.otherInvestors].some((i) => norm(i).includes(norm(name)));
      alerts.push({
        id: `a-${d.id}`,
        kind: "adjacent",
        title: `${name} linked to ${d.company}'s round`,
        why: `${name} (watchlist) is named ${asInvestor ? "as an investor" : "in the announcement"}. Possible portfolio-adjacent development: ${roundLine(d)}.`,
        href: `/deals?deal=${encodeURIComponent(d.id)}`,
        dealId: d.id,
      });
    }
  }

  const mandate = deals
    .filter((d) => d.tier === 1 && !d.watchlistMatch)
    .sort((a, b) => (b.amountUsdM ?? -1) - (a.amountUsdM ?? -1))
    .slice(0, mandateLimit);
  for (const d of mandate) {
    alerts.push({
      id: `m-${d.id}`,
      kind: "mandate",
      title: `${d.company} · ${d.stage} ${d.sector}`,
      why: `Matches your mandate on sector and stage. ${roundLine(d)}.`,
      href: `/deals?deal=${encodeURIComponent(d.id)}`,
      dealId: d.id,
    });
  }

  for (const inv of (newInvestors ?? []).slice(0, newInvestorLimit)) {
    const first = inv.companies[0];
    alerts.push({
      id: `n-${inv.name}`,
      kind: "new-investor",
      title: `New in your verticals: ${inv.name}`,
      why: `Not seen in the previous ${priorWeeks} stored week${priorWeeks === 1 ? "" : "s"}; backed ${inv.companies
        .map((c) => `${c.company} (${c.sector}${c.stage !== "Undisclosed" ? `, ${c.stage}` : ""})`)
        .join(", ")}.`,
      href: `/deals?deal=${encodeURIComponent(first.id)}`,
      dealId: first.id,
    });
  }

  for (const inv of investorActivity(deals).filter((i) => i.deals >= 2).slice(0, investorLimit)) {
    alerts.push({
      id: `i-${inv.name}`,
      kind: "investor",
      title: `${inv.name} backed ${inv.deals} deals this week`,
      why: `Repeat activity in one week can signal an active thesis${inv.leads ? ` (led ${inv.leads})` : ""}: ${inv.companies
        .map((c) => c.company)
        .join(", ")}.`,
      href: `/deals?investor=${encodeURIComponent(inv.name)}`,
    });
  }

  return alerts;
}
