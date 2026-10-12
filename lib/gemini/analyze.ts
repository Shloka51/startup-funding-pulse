import "server-only";
import { Type, type Schema } from "@google/genai";
import { geminiModel, getGemini, isTransient, sleep } from "@/lib/gemini/client";
import { STAGES, type AppConfig, type ExtractedDeal, type Pattern, type Stage, type WeeklyBrief } from "@/lib/types";

/** Compact facts about the previous reporting week, for "what changed" (only when it exists). */
export interface PreviousWeekContext {
  window: { start: string; end: string };
  deals: number;
  capitalUsdM: number;
  sectors: { sector: string; deals: number }[];
  stages: { stage: string; deals: number }[];
  activeInvestors: string[];
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    deals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          sector: { type: Type.STRING },
          stage: { type: Type.STRING, enum: [...STAGES] },
          sameAs: { type: Type.INTEGER, nullable: true },
        },
        required: ["id", "sector", "stage", "sameAs"],
      },
    },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "detail", "companies"],
      },
    },
    summary: { type: Type.STRING },
    investorInsights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          investors: { type: Type.ARRAY, items: { type: Type.STRING } },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "detail", "investors", "companies"],
      },
    },
    followUps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          why: { type: Type.STRING },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["action", "why", "companies"],
      },
    },
    changes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["deals", "patterns", "summary", "investorInsights", "followUps", "changes"],
};

function buildPrompt(deals: ExtractedDeal[], config: AppConfig, previous: PreviousWeekContext | null) {
  const lines = deals.map(
    (d, i) =>
      `${i} | ${d.company} | ${d.sector} / ${d.subSector || "-"} | ${d.stage} | ${d.amount} | lead: ${d.leadInvestor}` +
      (d.otherInvestors.length ? ` | also: ${d.otherInvestors.join(", ")}` : "") +
      (d.city ? ` | ${d.city}` : "")
  );

  return `You are an analyst writing for a venture scout at an Indian family office. Below is every Indian startup funding deal announced in the past 7 days.

THE SCOUT'S FOCUS
Sectors: ${config.targetSectors.join(", ") || "(none set)"}
Stages: ${config.targetStages.join(", ") || "(none set)"}

DEALS (id | company | sector / sub-sector | stage | amount | investors | city)
${lines.join("\n")}

TASK 1 — deals: return one entry per deal id with a consistent sector and stage.
- If a deal fits one of the scout's focus sectors, use that focus sector's exact name (e.g. a lending or payments company → "Fintech" if "Fintech" is a focus sector).
- Otherwise keep a short broad sector name, spelled consistently across deals.
- stage must be one of: ${STAGES.join(", ")}.
- sameAs: if this deal is the SAME funding round as an earlier id in the list (same company under a different name, e.g. a brand vs its parent's legal name, with matching amount/investors), give that earlier id; otherwise null.

TASK 2 — patterns: 2 to 4 insights about where capital moved this week.
- Each must be backed by at least 2 deals from the list and name those companies exactly as written above.
- Look for: clusters by sector/sub-sector and stage, repeat or very active investors, unusually large or small rounds, geographic concentration, notable shifts.
- title: ≤ 10 words, specific and quantified (e.g. "3 Series A rounds in fintech infrastructure").
- detail: 1–2 sentences on why it matters, addressed to the reader as "you" (never "the scout"). Only use facts from the list.
- If there are too few deals for 2 genuine patterns, return fewer. Never invent deals or numbers.

TASK 3 — summary: an executive summary in 2–3 sentences (≤ 70 words) of where capital moved this week and what matters most for the scout's mandate. Plain, factual, addressed to "you".

TASK 4 — investorInsights: 0 to 3 observations about investor behaviour (an investor leading or joining several rounds, a cluster of investors in one niche, a new type of backer). Each names the investors exactly as written in the deal list and the companies involved. Return [] if nothing genuine stands out.

TASK 5 — followUps: 2 to 4 concrete next actions for the scout (e.g. "Request an intro to <company>'s founders", "Track <investor>'s next fintech seed deal"). action ≤ 14 words; why ≤ 25 words, tied to the mandate. Name the companies involved exactly as written above.

TASK 6 — changes: ${
    previous
      ? `compare with the PREVIOUS WEEK below and return 1–3 short, quantified statements of what changed (e.g. "Fintech rounds fell from 6 to 3"). Use only these numbers.
PREVIOUS WEEK (${previous.window.start.slice(0, 10)} to ${previous.window.end.slice(0, 10)}): ${previous.deals} deals, ≈$${Math.round(previous.capitalUsdM)}M disclosed.
Sectors: ${previous.sectors.map((x) => `${x.sector} ${x.deals}`).join(", ") || "n/a"}.
Stages: ${previous.stages.map((x) => `${x.stage} ${x.deals}`).join(", ") || "n/a"}.
Most active investors: ${previous.activeInvestors.join(", ") || "n/a"}.`
      : "there is no previous week to compare against. Return an empty array []."
  }`;
}

export interface AnalysisResult {
  normalized: Map<number, { sector: string; stage: Stage; sameAs: number | null }>;
  patterns: Pattern[];
  /** null if the brief part of the response was unusable. */
  brief: WeeklyBrief | null;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Keep only names that exist in `known` (case-insensitive), returned in their canonical spelling. */
function grounded(list: unknown, known: Map<string, string>): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((x) => known.get(String(x).toLowerCase().trim())).filter((x): x is string => !!x))];
}

function validateBrief(
  o: Record<string, unknown>,
  companies: Map<string, string>,
  investors: Map<string, string>,
  previous: PreviousWeekContext | null
): WeeklyBrief | null {
  const summary = clip(o.summary, 600);
  if (!summary) return null;

  const investorInsights: WeeklyBrief["investorInsights"] = [];
  for (const raw of Array.isArray(o.investorInsights) ? (o.investorInsights as Record<string, unknown>[]) : []) {
    const title = clip(raw?.title, 120);
    const detail = clip(raw?.detail, 400);
    const inv = grounded(raw?.investors, investors);
    // An investor insight must name at least one investor that really appears in this week's deals.
    if (title && detail && inv.length) investorInsights.push({ title, detail, investors: inv, companies: grounded(raw?.companies, companies) });
    if (investorInsights.length === 3) break;
  }

  const followUps: WeeklyBrief["followUps"] = [];
  for (const raw of Array.isArray(o.followUps) ? (o.followUps as Record<string, unknown>[]) : []) {
    const action = clip(raw?.action, 140);
    const why = clip(raw?.why, 260);
    if (action && why) followUps.push({ action, why, companies: grounded(raw?.companies, companies) });
    if (followUps.length === 4) break;
  }

  const changes = previous && Array.isArray(o.changes) ? o.changes.map((c) => clip(c, 200)).filter(Boolean).slice(0, 3) : [];

  return { summary, investorInsights, followUps, changes, comparedTo: previous ? previous.window : null };
}

function validate(raw: unknown, deals: ExtractedDeal[], previous: PreviousWeekContext | null): AnalysisResult {
  if (!raw || typeof raw !== "object") throw new Error("Response is not an object");
  const o = raw as { deals?: unknown; patterns?: unknown };
  if (!Array.isArray(o.deals) || !Array.isArray(o.patterns)) throw new Error("Missing deals/patterns arrays");

  const normalized = new Map<number, { sector: string; stage: Stage; sameAs: number | null }>();
  for (const d of o.deals as Record<string, unknown>[]) {
    const id = Number(d?.id);
    if (!Number.isInteger(id) || id < 0 || id >= deals.length) continue;
    const sector = typeof d.sector === "string" && d.sector.trim() ? d.sector.trim().slice(0, 40) : deals[id].sector;
    const stage = (STAGES as readonly string[]).includes(d.stage as string) ? (d.stage as Stage) : deals[id].stage;
    const same = Number(d.sameAs);
    const sameAs = d.sameAs !== null && Number.isInteger(same) && same >= 0 && same < id ? same : null;
    normalized.set(id, { sector, stage, sameAs });
  }

  // Keep only patterns grounded in real deals from this week.
  const known = new Map(deals.map((d) => [d.company.toLowerCase(), d.company]));
  const patterns: Pattern[] = [];
  for (const p of o.patterns as Record<string, unknown>[]) {
    const title = typeof p?.title === "string" ? p.title.trim() : "";
    const detail = typeof p?.detail === "string" ? p.detail.trim() : "";
    const companies = Array.isArray(p?.companies)
      ? [...new Set(p.companies.map((c) => known.get(String(c).toLowerCase().trim())).filter((c): c is string => !!c))]
      : [];
    if (title && detail && companies.length >= 2) {
      patterns.push({ title: title.slice(0, 120), detail: detail.slice(0, 400), companies });
    }
    if (patterns.length === 4) break;
  }

  const investors = new Map<string, string>();
  for (const d of deals) {
    for (const name of [d.leadInvestor, ...d.otherInvestors]) {
      if (name && name !== "Undisclosed") investors.set(name.toLowerCase(), name);
    }
  }
  const brief = validateBrief(o as Record<string, unknown>, known, investors, previous);

  return { normalized, patterns, brief };
}

/**
 * ONE Gemini Flash call over the whole week: consistent sectors/stages, 2–4 patterns, and the
 * weekly brief (summary, investor read, follow-ups, changes vs the previous week if it exists).
 * Retries once on bad JSON and backs off on rate limits. Throws if it ultimately fails —
 * the pipeline then shows deals without patterns.
 */
export async function analyzeWeek(
  deals: ExtractedDeal[],
  config: AppConfig,
  previous: PreviousWeekContext | null = null
): Promise<AnalysisResult> {
  if (deals.length === 0) return { normalized: new Map(), patterns: [], brief: null };
  const ai = getGemini();
  if (!ai) throw new Error("GEMINI_API_KEY not set");

  let badJsonRetries = 1;
  let transientRetries = 2;
  let lastError: unknown = new Error("Unknown error");

  for (let attempt = 0; attempt < 5; attempt++) {
    let text: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model: geminiModel(),
        contents: buildPrompt(deals, config, previous),
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(90_000),
        },
      });
      text = res.text;
    } catch (err) {
      lastError = err;
      if (isTransient(err) && transientRetries-- > 0) {
        await sleep(2000 * (3 - transientRetries));
        continue;
      }
      break;
    }

    try {
      return validate(JSON.parse(text ?? ""), deals, previous);
    } catch (err) {
      lastError = err;
      if (badJsonRetries-- > 0) continue;
      break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
