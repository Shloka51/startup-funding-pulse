import "server-only";
import { GoogleGenAI } from "@google/genai";

// All AI in this app goes through Google Gemini Flash. No other provider is used.
const DEFAULT_MODEL = "gemini-3.8-flash";

let client: GoogleGenAI | null | undefined;

export function getGemini(): GoogleGenAI | null {
  if (client !== undefined) return client;
  const key = process.env.GEMINI_API_KEY;
  client = key && key !== "your-gemini-api-key" ? new GoogleGenAI({ apiKey: key }) : null;
  return client;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** True for rate-limit / overload errors worth waiting and retrying. */
export function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|timed? ?out|ECONNRESET|fetch failed/i.test(msg);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run async tasks with at most `limit` in flight. Results keep input order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
