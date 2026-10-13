import { formatRange } from "@/lib/dates";
import { formatAmount, formatUsdM } from "@/lib/format";
import { sectorBreakdown } from "@/lib/summary";
import { STAGES, type Deal, type ExtractedDeal, type Stage } from "@/lib/types";

/** Plain-code facts about the week. Nothing here comes from AI. */

export interface StageRow {
  stage: Stage;
  deals: number;
  usdM: number;
}

/** Deals per stage in funding order (Pre-seed → Series D+, then Bridge/Debt/Undisclosed). */
export function stageBreakdown(deals: ExtractedDeal[]): StageRow[] {
  return STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, deals: inStage.length, usdM: inStage.reduce((s, d) => s + (d.amountUsdM ?? 0), 0) };
  });
}

export interface InvestorRow {
  name: string;
  deals: number;
  leads: number;
  companies: { company: string; id?: string }[];
}

function cleanInvestor(name: string) {
  return name.replace(/\s*(,|and)?\s*others?\.?$/i, "").trim();
}

/** Investors by number of deals they appeared in this week (lead or participant). */
export function investorActivity(deals: (ExtractedDeal & { id?: string })[]): InvestorRow[] {
  const map = new Map<string, InvestorRow>();
  for (const d of deals) {
    const names = [d.leadInvestor, ...d.otherInvestors].map(cleanInvestor).filter((n) => n && n !== "Undisclosed");
    const seen = new Set<string>();
    names.forEach((name, i) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const row = map.get(key) ?? { name, deals: 0, leads: 0, companies: [] };
      row.deals += 1;
      if (i === 0 && d.leadInvestor !== "Undisclosed") row.leads += 1;
      row.companies.push({ company: d.company, id: d.id });
      map.set(key, row);
    });
  }
  return [...map.values()].sort((a, b) => b.deals - a.deals || b.leads - a.leads || a.name.localeCompare(b.name));
}

export interface Fact {
  label: string;
  value: string;
  detail?: string;
}

/** The "Observed in data" block of the brief. */
export function observedFacts(deals: Deal[]): Fact[] {
  if (deals.length === 0) return [];
  const disclosed = deals.filter((d) => d.amountUsdM !== null);
  const total = disclosed.reduce((s, d) => s + (d.amountUsdM ?? 0), 0);
  const facts: Fact[] = [
    {
      label: "Volume",
      value: `${deals.length} rounds`,
      detail: `${disclosed.length} disclosed (≈${formatUsdM(total)}), ${deals.length - disclosed.length} undisclosed`,
    },
  ];

  const largest = [...disclosed].sort((a, b) => (b.amountUsdM ?? 0) - (a.amountUsdM ?? 0))[0];
  if (largest) {
    facts.push({
      label: "Largest round",
      value: `${largest.company} · ${formatAmount(largest.amount)}`,
      detail: [largest.stage !== "Undisclosed" ? largest.stage : null, largest.sector].filter(Boolean).join(" · "),
    });
  }

  const [topSector] = sectorBreakdown(deals, 99);
  const topStage = stageBreakdown(deals)
    .filter((s) => s.stage !== "Undisclosed")
    .sort((a, b) => b.deals - a.deals)[0];
  if (topSector) {
    facts.push({
      label: "Busiest sector / stage",
      value: `${topSector.sector} (${topSector.deals})`,
      detail: topStage && topStage.deals > 0 ? `${topStage.stage} was the most common stage (${topStage.deals})` : undefined,
    });
  }

  const tier1 = deals.filter((d) => d.tier === 1).length;
  const tier2 = deals.filter((d) => d.tier === 2).length;
  facts.push({ label: "Mandate fit", value: `${tier1} full match${tier1 === 1 ? "" : "es"}`, detail: `${tier2} match on sector or stage only` });

  const active = investorActivity(deals).filter((i) => i.deals >= 2);
  if (active.length) {
    facts.push({
      label: "Repeat investors",
      value: active.slice(0, 3).map((i) => `${i.name} (${i.deals})`).join(", "),
      detail: `${active.length} investor${active.length === 1 ? "" : "s"} backed 2+ deals this week`,
    });
  }
  return facts;
}

export interface MomentumRow {
  sector: string;
  now: number;
  before: number;
  delta: number;
}

/** Sector deal counts this week vs the previous reporting week. Only call when a previous week exists. */
export function sectorMomentum(current: ExtractedDeal[], previous: ExtractedDeal[]): MomentumRow[] {
  const now = new Map(sectorBreakdown(current, 99).map((r) => [r.sector, r.deals]));
  const before = new Map(sectorBreakdown(previous, 99).map((r) => [r.sector, r.deals]));
  const sectors = new Set([...now.keys(), ...before.keys()]);
  return [...sectors]
    .map((sector) => ({ sector, now: now.get(sector) ?? 0, before: before.get(sector) ?? 0, delta: 0 }))
    .map((r) => ({ ...r, delta: r.now - r.before }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.now - a.now)
    .slice(0, 8);
}

export interface WeekPoint {
  label: string;
  deals: number;
  usdM: number;
}

/** One point per stored reporting week, oldest first. */
export function weeklySeries(history: { window: { start: string; end: string }; deals: ExtractedDeal[] }[]): WeekPoint[] {
  return [...history]
    .reverse()
    .map((d) => ({
      label: formatRange(d.window.start, d.window.end).replace(/ \d{4}$/, ""),
      deals: d.deals.length,
      usdM: d.deals.reduce((s, x) => s + (x.amountUsdM ?? 0), 0),
    }));
}

export interface NewInvestorRow {
  name: string;
  companies: { company: string; id: string; sector: string; stage: string }[];
}

/**
 * "Has a new investor started making moves in his target verticals?"
 * Investors in this week's target-sector deals who appear in none of the earlier stored weeks.
 * Returns null when there's no earlier week to compare with (so nothing is falsely called "new").
 */
export function newInvestorsInFocus(deals: Deal[], priorDeals: ExtractedDeal[] | null): NewInvestorRow[] | null {
  if (!priorDeals || priorDeals.length === 0) return null;
  const seen = new Set(
    priorDeals.flatMap((d) => [d.leadInvestor, ...d.otherInvestors]).map((n) => cleanInvestor(n).toLowerCase())
  );
  const map = new Map<string, NewInvestorRow>();
  for (const d of deals.filter((x) => x.sectorMatch)) {
    for (const raw of [d.leadInvestor, ...d.otherInvestors]) {
      const name = cleanInvestor(raw);
      if (!name || name === "Undisclosed" || seen.has(name.toLowerCase())) continue;
      const row = map.get(name.toLowerCase()) ?? { name, companies: [] };
      if (!row.companies.some((c) => c.id === d.id)) row.companies.push({ company: d.company, id: d.id, sector: d.sector, stage: d.stage });
      map.set(name.toLowerCase(), row);
    }
  }
  return [...map.values()].sort((a, b) => b.companies.length - a.companies.length || a.name.localeCompare(b.name));
}

/**
 * "What changed vs the previous week", computed from stored deals (no AI, so the numbers are exact).
 * Only call with a real previous full week.
 */
export function observedChanges(current: Deal[], previous: Deal[]): string[] {
  const usd = (ds: Deal[]) => ds.reduce((s, d) => s + (d.amountUsdM ?? 0), 0);
  const arrow = (a: number, b: number) => (b > a ? "▲" : b < a ? "▼" : "=");
  const out: string[] = [];

  out.push(`Deals ${previous.length} → ${current.length} (${arrow(previous.length, current.length)} ${Math.abs(current.length - previous.length)})`);
  const [pu, cu] = [usd(previous), usd(current)];
  if (pu > 0 || cu > 0) out.push(`Disclosed capital ≈${formatUsdM(pu)} → ≈${formatUsdM(cu)}`);

  const pm = previous.filter((d) => d.tier === 1).length;
  const cm = current.filter((d) => d.tier === 1).length;
  out.push(`Full mandate matches ${pm} → ${cm}`);

  const sectors = sectorMomentum(current, previous).filter((r) => r.delta !== 0).slice(0, 3);
  if (sectors.length) out.push(`Biggest sector moves: ${sectors.map((r) => `${r.sector} ${r.before} → ${r.now}`).join(", ")}`);

  const ps = new Map(stageBreakdown(previous).map((r) => [r.stage, r.deals]));
  const stages = stageBreakdown(current)
    .filter((r) => r.stage !== "Undisclosed")
    .map((r) => ({ stage: r.stage, before: ps.get(r.stage) ?? 0, now: r.deals }))
    .filter((r) => r.before !== r.now)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    .slice(0, 2);
  if (stages.length) out.push(`Stage shifts: ${stages.map((r) => `${r.stage} ${r.before} → ${r.now}`).join(", ")}`);

  return out;
}
