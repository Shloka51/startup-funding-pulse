/**
 * Reporting weeks, keyed by the Monday (IST) they start on, e.g. "2026-09-28".
 * The live brief is a rolling 7-day window; it's keyed to the Monday its window starts in.
 */

const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = (5 * 60 + 30) * 60 * 1000;
export const ARCHIVE_WEEKS = 8;

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(iso: string | number): string {
  return isoDate(new Date(iso).getTime() + IST_OFFSET);
}

/** The Monday on or before an IST date. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return isoDate(d.getTime() - back * DAY);
}

/**
 * Week a window belongs to: the Monday of its midpoint (start + 3.5 days). This keys a
 * Monday-to-Monday window, a rolling 7-day window and a week-to-date window consistently.
 */
export function weekKeyOf(windowStart: string): string {
  return mondayOf(istDate(new Date(windowStart).getTime() + 3.5 * DAY));
}

/** Monday (IST) of the week containing `now`, i.e. the week in progress. */
export function currentWeekKey(now = Date.now()): string {
  return mondayOf(istDate(now));
}

/** The most recent fully completed Monday–Monday week. */
export function completedWeekKey(now = Date.now()): string {
  return shiftKey(currentWeekKey(now), -1);
}

/** This week so far: Monday 00:00 IST → now. */
export function weekToDateWindow(now = Date.now()): { start: string; end: string } {
  return { start: windowForKey(currentWeekKey(now)).start, end: new Date(now).toISOString() };
}

export const isWeekKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && mondayOf(s) === s;

/** Monday 00:00 IST → next Monday 00:00 IST, as ISO strings. */
export function windowForKey(key: string): { start: string; end: string } {
  const start = Date.parse(`${key}T00:00:00+05:30`);
  return { start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString() };
}

export function shiftKey(key: string, weeks: number): string {
  return isoDate(Date.parse(`${key}T00:00:00Z`) + weeks * 7 * DAY);
}

/** The latest week plus the ARCHIVE_WEEKS − 1 before it, newest first. */
export function recentKeys(latestKey: string, n = ARCHIVE_WEEKS): string[] {
  return Array.from({ length: n }, (_, i) => shiftKey(latestKey, -i));
}

/** Google News date operators covering a window (a day of slack each side; results are trimmed to the window later). */
export function searchRange(window: { start: string; end: string }) {
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  return { after: istDate(start - DAY), before: istDate(end + DAY) };
}
