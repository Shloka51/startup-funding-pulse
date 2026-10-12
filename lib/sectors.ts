/**
 * Fixed sector → colour slot (1–8). Colour follows the sector, never its rank,
 * so "Fintech" is the same blue everywhere and every week. Unknown sectors use slot 0 (grey).
 */
const SLOTS: [RegExp, number][] = [
  [/fintech|lending|payments|insurtech|wealth/i, 1],
  [/consumer|d2c|retail|e-?commerce|food|beauty/i, 2],
  [/health|medtech|pharma|biotech|therapeutic/i, 3],
  [/saas|software|enterprise/i, 4],
  [/deep ?tech|semiconductor|space|quantum|robot/i, 5],
  [/climate|clean|energy|sustainab|agri/i, 6],
  [/\bai\b|artificial|machine learning|genai/i, 7],
  [/mobility|ev\b|electric|auto|logistics/i, 8],
];

export function sectorSlot(sector: string): number {
  for (const [re, slot] of SLOTS) if (re.test(sector)) return slot;
  return 0;
}

/** Inline style that sets the --c custom property for the sector-* helper classes. */
export function sectorStyle(sector: string): React.CSSProperties {
  return { ["--c" as string]: `var(--s${sectorSlot(sector)})` };
}
