"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DealDrawer from "@/components/deals/DealDrawer";
import { AmountText, MatchBadge, SectorTag } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { STAGES, type Deal, type Pattern } from "@/lib/types";

export interface ExplorerFilters {
  q?: string;
  sector?: string;
  stage?: string;
  investor?: string;
  match?: string;
  date?: string;
  deal?: string;
}

type SortKey = "match" | "company" | "sector" | "stage" | "amount" | "lead" | "date";

const MATCH_OPTIONS = [
  { value: "", label: "All matches" },
  { value: "mandate", label: "Mandate (sector + stage)" },
  { value: "partial", label: "Partial (sector or stage)" },
  { value: "outside", label: "Outside mandate" },
  { value: "watchlist", label: "Watchlist involved" },
];

const cleanInvestor = (n: string) => n.replace(/\s*(,|and)?\s*others?\.?$/i, "").trim();
const investorsOf = (d: Deal) =>
  [d.leadInvestor, ...d.otherInvestors].map(cleanInvestor).filter((n) => n && n !== "Undisclosed");

function compare(a: Deal, b: Deal, key: SortKey): number {
  switch (key) {
    case "company":
      return a.company.localeCompare(b.company);
    case "sector":
      return a.sector.localeCompare(b.sector);
    case "stage":
      return STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
    case "amount":
      return (a.amountUsdM ?? -1) - (b.amountUsdM ?? -1);
    case "lead":
      return a.leadInvestor.localeCompare(b.leadInvestor);
    case "date":
      return a.date.localeCompare(b.date);
    case "match":
      return a.tier - b.tier || Number(!!b.watchlistMatch) - Number(!!a.watchlistMatch);
  }
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] text-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 min-w-0 rounded-md border bg-surface px-2 text-xs outline-none focus:border-accent ${
          value ? "border-accent/60 text-ink" : "border-line text-muted"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DealsExplorer({
  deals,
  patterns,
  initial,
}: {
  deals: Deal[];
  patterns: Pattern[];
  initial: ExplorerFilters;
}) {
  const [q, setQ] = useState(initial.q ?? "");
  const [sector, setSector] = useState(initial.sector ?? "");
  const [stage, setStage] = useState(initial.stage ?? "");
  const [investor, setInvestor] = useState(initial.investor ?? "");
  const [match, setMatch] = useState(initial.match ?? "");
  const [date, setDate] = useState(initial.date ?? "");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "match", dir: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(initial.deal ?? null);

  const options = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
    const investorKeys = new Map<string, string>();
    deals.flatMap(investorsOf).forEach((n) => investorKeys.set(n.toLowerCase(), investorKeys.get(n.toLowerCase()) ?? n));
    return {
      sectors: uniq(deals.map((d) => d.sector)),
      stages: STAGES.filter((s) => deals.some((d) => d.stage === s)),
      investors: [...investorKeys.values()].sort((a, b) => a.localeCompare(b)),
      dates: [...new Set(deals.map((d) => d.date))].sort().reverse(),
    };
  }, [deals]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = deals
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => {
        if (sector && d.sector !== sector) return false;
        if (stage && d.stage !== stage) return false;
        if (date && d.date !== date) return false;
        if (investor && !investorsOf(d).some((n) => n.toLowerCase() === investor.toLowerCase())) return false;
        if (match === "mandate" && d.tier !== 1) return false;
        if (match === "partial" && d.tier !== 2) return false;
        if (match === "outside" && d.tier !== 3) return false;
        if (match === "watchlist" && !d.watchlistMatch) return false;
        if (needle) {
          const hay = [d.company, d.sector, d.subSector, d.city, d.leadInvestor, ...d.otherInvestors, d.oneLineSummary, d.headline]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
    rows.sort((a, b) => {
      // Undisclosed amounts always sink to the bottom when sorting by amount.
      if (sort.key === "amount" && (a.d.amountUsdM === null) !== (b.d.amountUsdM === null)) {
        return a.d.amountUsdM === null ? 1 : -1;
      }
      return compare(a.d, b.d, sort.key) * sort.dir || a.i - b.i;
    });
    return rows.map((r) => r.d);
  }, [deals, q, sector, stage, investor, match, date, sort]);

  // Keep the URL in sync so filtered views and open deals can be shared or linked to.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sector) params.set("sector", sector);
    if (stage) params.set("stage", stage);
    if (investor) params.set("investor", investor);
    if (match) params.set("match", match);
    if (date) params.set("date", date);
    if (selectedId) params.set("deal", selectedId);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, sector, stage, investor, match, date, selectedId]);

  const selected = selectedId ? deals.find((d) => d.id === selectedId) ?? null : null;
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const active = [q, sector, stage, investor, match, date].filter(Boolean).length;

  function reset() {
    setQ("");
    setSector("");
    setStage("");
    setInvestor("");
    setMatch("");
    setDate("");
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "amount" || key === "date" ? -1 : 1 }));
  }

  function Th({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) {
    const on = sort.key === k;
    return (
      <th scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-ink ${on ? "text-ink" : ""}`}
        >
          {children}
          <span aria-hidden className={`text-[9px] ${on ? "" : "opacity-0"}`}>{sort.dir === 1 ? "▲" : "▼"}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-[minmax(12rem,1.6fr)_repeat(5,minmax(0,1fr))]">
          <label className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-4 lg:col-span-1">
            <span className="text-[11px] text-faint">Search</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Company, investor, keyword…"
              className="h-8 rounded-md border border-line bg-surface px-2.5 text-xs outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
          <Select label="Sector" value={sector} onChange={setSector} options={[{ value: "", label: "All sectors" }, ...options.sectors.map((s) => ({ value: s, label: s }))]} />
          <Select label="Stage" value={stage} onChange={setStage} options={[{ value: "", label: "All stages" }, ...options.stages.map((s) => ({ value: s, label: s }))]} />
          <Select label="Investor" value={investor} onChange={setInvestor} options={[{ value: "", label: "All investors" }, ...options.investors.map((s) => ({ value: s, label: s }))]} />
          <Select label="Match" value={match} onChange={setMatch} options={MATCH_OPTIONS} />
          <Select
            label="Announced"
            value={date}
            onChange={setDate}
            options={[{ value: "", label: "Whole week" }, ...options.dates.map((d) => ({ value: d, label: formatShortDate(d) }))]}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            Showing <span className="font-semibold text-ink">{filtered.length}</span> of {deals.length} deals
            {sort.key !== "match" && <span className="text-faint"> · sorted by {sort.key}</span>}
          </span>
          {active > 0 && (
            <button type="button" onClick={reset} className="font-medium text-accent hover:underline">
              Clear {active} filter{active === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-[13px] font-medium">No deals match these filters</p>
          <button type="button" onClick={reset} className="mt-2 text-xs font-medium text-accent hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="scroll-quiet hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  <Th k="company">Company</Th>
                  <Th k="sector">Sector</Th>
                  <Th k="stage">Stage</Th>
                  <Th k="amount" right>Amount</Th>
                  <Th k="lead">Lead investor</Th>
                  <Th k="date">Date</Th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Source</th>
                  <Th k="match">Match</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(d.id);
                      }
                    }}
                    aria-label={`Open details for ${d.company}`}
                    className={`cursor-pointer outline-none transition hover:bg-surface-2 focus-visible:bg-surface-2 ${
                      selectedId === d.id ? "bg-accent-soft/60" : ""
                    }`}
                  >
                    <td className="max-w-[16rem] px-3 py-2.5">
                      <span className="block truncate font-medium text-ink">{d.company}</span>
                      <span className="block truncate text-[11px] text-faint">{d.subSector || d.oneLineSummary}</span>
                    </td>
                    <td className="max-w-[10rem] px-3 py-2.5 text-muted"><SectorTag sector={d.sector} strong={d.sectorMatch} /></td>
                    <td className={`whitespace-nowrap px-3 py-2.5 ${d.stage === "Undisclosed" ? "text-faint" : d.stageMatch ? "font-medium text-ink" : "text-muted"}`}>
                      {d.stage === "Undisclosed" ? "n/a" : d.stage}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right"><AmountText deal={d} /></td>
                    <td className={`max-w-[11rem] truncate px-3 py-2.5 ${d.leadInvestor === "Undisclosed" ? "text-faint" : "text-muted"}`}>
                      {d.leadInvestor}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">{formatShortDate(d.date)}</td>
                    <td className="max-w-[9rem] px-3 py-2.5 text-muted">
                      <span className="block truncate">{d.sourceName}</span>
                      {d.alsoReportedBy.length > 0 && <span className="text-[11px] text-faint">+{d.alsoReportedBy.length} more</span>}
                    </td>
                    <td className="px-3 py-2.5"><MatchBadge deal={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="w-full rounded-lg border border-line bg-surface p-3 text-left transition active:bg-surface-2"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{d.company}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <SectorTag sector={d.sector} />
                        <span>· {d.stage === "Undisclosed" ? "Stage n/a" : d.stage}</span>
                        <span>· {formatShortDate(d.date)}</span>
                      </span>
                    </span>
                    <span className="text-xs"><AmountText deal={d} /></span>
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
                    <span className="truncate">Lead: {d.leadInvestor}</span>
                    <MatchBadge deal={d} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <DealDrawer deal={selected} patterns={patterns} onClose={closeDrawer} />
    </div>
  );
}
