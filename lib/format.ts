/** $ in millions → "$750K", "$12.5M", "$1.2B" */
export function formatUsdM(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}B`;
  if (m >= 1) return `$${m >= 100 ? Math.round(m) : Number(m.toFixed(1))}M`;
  return `$${Math.round(m * 1000)}K`;
}

/** Whether the reported amount is already in US dollars (so "≈ $X" would be redundant). */
export function isUsd(amount: string) {
  return /\$|usd/i.test(amount);
}

/** Tidy how outlets write amounts: "INR 20 Cr" / "Rs 16.1 crore" → "₹20 Cr"; "$7 Mn" / "USD 10 million" → "$7M". */
export function formatAmount(amount: string): string {
  let a = amount.trim();
  if (!a || /^undisclosed$/i.test(a)) return "Undisclosed";
  a = a
    .replace(/^(?:inr|rs\.?)\s*/i, "₹")
    .replace(/^usd\s*/i, "$")
    .replace(/^([₹$])\s+/, "$1")
    .replace(/\s*(?:crores?|cr\.?)\b\.?/i, " Cr")
    .replace(/\s*(?:millions?|mn|mln)\b\.?/i, "M")
    .replace(/\s*(?:billions?|bn)\b\.?/i, "B")
    .replace(/\s*(?:lakhs?)\b/i, " lakh")
    .replace(/(\d),(?=\d{3}\b)/g, "$1,");
  return a;
}
