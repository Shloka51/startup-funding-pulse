import "server-only";
import { Type, type Schema } from "@google/genai";
import { geminiModel, getGemini, isTransient, sleep } from "@/lib/gemini/client";
import { STAGES, type AppConfig, type ExtractedDeal, type RawItem, type Stage } from "@/lib/types";

const BASE_SECTORS = [
  "Fintech", "Climate", "SaaS", "AI", "Healthtech", "Edtech", "Consumer & D2C", "E-commerce",
  "Deeptech", "Mobility & EV", "Agritech", "Logistics", "Media & Gaming", "Proptech", "Other",
];

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isFundingEvent: { type: Type.BOOLEAN },
    isIndian: { type: Type.BOOLEAN },
    company: { type: Type.STRING },
    sector: { type: Type.STRING },
    subSector: { type: Type.STRING },
    stage: { type: Type.STRING, enum: [...STAGES] },
    amount: { type: Type.STRING },
    amountUsdM: { type: Type.NUMBER, nullable: true },
    leadInvestor: { type: Type.STRING },
    otherInvestors: { type: Type.ARRAY, items: { type: Type.STRING } },
    city: { type: Type.STRING },
    date: { type: Type.STRING },
    oneLineSummary: { type: Type.STRING },
  },
  required: [
    "isFundingEvent", "isIndian", "company", "sector", "subSector", "stage", "amount",
    "amountUsdM", "leadInvestor", "otherInvestors", "city", "date", "oneLineSummary",
  ],
  propertyOrdering: [
    "isFundingEvent", "isIndian", "company", "sector", "subSector", "stage", "amount",
    "amountUsdM", "leadInvestor", "otherInvestors", "city", "date", "oneLineSummary",
  ],
};

function buildPrompt(item: RawItem, config: AppConfig) {
  const sectors = [...new Set([...config.targetSectors, ...BASE_SECTORS])];
  return `You extract structured startup-funding data from one news article for a venture scout in India.

ARTICLE
Headline: ${item.title}
Snippet: ${item.snippet || "(none)"}
Outlet: ${item.source}
Published: ${item.publishedDate.slice(0, 10)}

RULES
- isFundingEvent: true ONLY if the article announces that one specific company raised (or closed) a private funding round: equity, venture debt, or a structured round. false for: VC/PE funds raising their own fund, IPOs, acquisitions, government schemes, grants, weekly roundups, "in talks"/rumoured rounds, trend reports, or anything that is not a single company's round.
- isIndian: true if the company is headquartered in India or is an Indian-founded startup operating in India.
- company: the company that raised money, in its usual short name (e.g. "Nat Habit", not "Nat Habit Pvt Ltd").
- sector: pick the single best fit from this list, using the exact spelling: ${sectors.join(", ")}.
- subSector: a short, specific niche, 1–4 words (e.g. "MSME lending", "EV charging", "Ayurvedic personal care").
- stage: one of ${STAGES.join(", ")}. Use "Undisclosed" if the article does not say. Series D or later → "Series D+".
- amount: as reported, short, keep the original currency (e.g. "₹142 crore", "$5.2M"). Use "Undisclosed" if not stated.
- amountUsdM: amount in millions of US dollars (use 1 USD ≈ 88 INR; 1 crore = 10 million INR). null if undisclosed.
- leadInvestor: the lead investor, or the main investor if only one is named. "Undisclosed" if none is named.
- otherInvestors: other named investors (may be empty).
- city: Indian city of the company if stated, else "".
- date: announcement date as YYYY-MM-DD; use the published date if unsure.
- oneLineSummary: ≤ 20 words, plain and factual: what the company does and, if stated, what the money is for. Do NOT repeat the amount, stage, or investor names (they are shown separately).
- Never invent facts that are not in the article. If isFundingEvent is false, still fill every field with your best guess or "".`;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Validate Gemini's JSON. Returns null if it isn't an Indian funding event; throws if malformed. */
export function validateExtraction(raw: unknown, item: RawItem): ExtractedDeal | null {
  if (!raw || typeof raw !== "object") throw new Error("Response is not an object");
  const o = raw as Record<string, unknown>;
  if (typeof o.isFundingEvent !== "boolean" || typeof o.isIndian !== "boolean") {
    throw new Error("Missing isFundingEvent/isIndian");
  }
  if (!o.isFundingEvent || !o.isIndian) return null;

  const company = str(o.company);
  if (!company || company.length > 80) throw new Error("Missing or invalid company");

  const stage = (STAGES as readonly string[]).includes(o.stage as string) ? (o.stage as Stage) : "Undisclosed";
  const usd = typeof o.amountUsdM === "number" && Number.isFinite(o.amountUsdM) && o.amountUsdM > 0 ? o.amountUsdM : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(o.date)) ? str(o.date) : item.publishedDate.slice(0, 10);

  return {
    company,
    sector: str(o.sector, "Other"),
    subSector: str(o.subSector),
    stage,
    amount: str(o.amount, "Undisclosed"),
    amountUsdM: usd,
    leadInvestor: str(o.leadInvestor, "Undisclosed"),
    otherInvestors: Array.isArray(o.otherInvestors)
      ? o.otherInvestors.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()).slice(0, 8)
      : [],
    city: str(o.city),
    date,
    oneLineSummary: str(o.oneLineSummary, item.title).slice(0, 220),
    sourceUrl: item.url,
    sourceName: item.source,
    headline: item.title,
  };
}

export type ExtractResult =
  | { kind: "deal"; deal: ExtractedDeal }
  | { kind: "not-funding" }
  | { kind: "failed"; reason: string };

/**
 * One Gemini Flash call for one article.
 * - Malformed/invalid JSON → retry once, then skip.
 * - Rate-limit/overload errors → back off and retry (up to 3 times).
 * Never throws.
 */
export async function extractDeal(item: RawItem, config: AppConfig): Promise<ExtractResult> {
  const ai = getGemini();
  if (!ai) return { kind: "failed", reason: "GEMINI_API_KEY not set" };

  let badJsonRetries = 1;
  let transientRetries = 3;
  let lastError = "Unknown error";

  for (let attempt = 0; attempt < 6; attempt++) {
    let text: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model: geminiModel(),
        contents: buildPrompt(item, config),
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
          thinkingConfig: { thinkingLevel: "LOW" as never },
          abortSignal: AbortSignal.timeout(30_000),
        },
      });
      text = res.text;
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 160) : "Gemini call failed";
      if (isTransient(err) && transientRetries-- > 0) {
        await sleep(1500 * (4 - transientRetries) + Math.random() * 500);
        continue;
      }
      break;
    }

    try {
      const deal = validateExtraction(JSON.parse(text ?? ""), item);
      return deal ? { kind: "deal", deal } : { kind: "not-funding" };
    } catch (err) {
      lastError = `Bad JSON from Gemini: ${err instanceof Error ? err.message : "parse error"}`;
      if (badJsonRetries-- > 0) continue;
      break;
    }
  }

  console.warn(`[extract] skipped "${item.title.slice(0, 80)}": ${lastError}`);
  return { kind: "failed", reason: lastError };
}
