// Pure, client-safe helpers for grouping Power BI reports into an
// Excel-PivotTable-style tree (Workspace -> code series -> individual reports)
// and for finding which numbers within a code series are still free.
import type { PowerBiItem } from "./powerbiTypes";

export type CodeSeriesGroup = {
  /** The series key, e.g. "DBK-STG" - everything before the numeric segment. */
  prefix: string;
  /** Items in this series, sorted by their numeric segment. */
  items: PowerBiItem[];
  /** Distinct numbers already in use, ascending. */
  usedNumbers: number[];
  min: number;
  max: number;
  /** Numbers between min and max that aren't in usedNumbers - i.e. free to reuse. */
  gaps: number[];
  /** Zero-padding width to match the series' own numbering (e.g. "005" -> 3). */
  numberWidth: number;
  /** Ceiling of assignable range. */
  rangeMax: number;
  /** Duplicate codes in this series. */
  duplicateCodes: Set<string>;
};

export type WorkspaceGroup = {
  workspaceId: string;
  workspaceName: string;
  items: PowerBiItem[];
  seriesGroups: CodeSeriesGroup[];
  /** Items whose name didn't match the standard code pattern at all. */
  uncoded: PowerBiItem[];
};

function splitCode(code: string): { prefix: string; number: number; numberStr: string } | null {
  const parts = code.split("-");
  if (parts.length < 3) return null;
  const numberStr = parts[2] ?? "";
  const number = parseInt(numberStr, 10);
  if (!Number.isFinite(number)) return null;
  return { prefix: `${parts[0]}-${parts[1]}`, number, numberStr };
}

const MAX_GAP_RANGE = 2000;

export function groupByCodeSeries(items: PowerBiItem[]): CodeSeriesGroup[] {
  const byPrefix = new Map<string, { item: PowerBiItem; number: number; numberStr: string }[]>();
  for (const item of items) {
    if (!item.reportCode) continue;
    const parsed = splitCode(item.reportCode);
    if (!parsed) continue;
    const bucket = byPrefix.get(parsed.prefix) ?? [];
    bucket.push({ item, number: parsed.number, numberStr: parsed.numberStr });
    byPrefix.set(parsed.prefix, bucket);
  }

  const groups: CodeSeriesGroup[] = [];
  for (const [prefix, entries] of byPrefix) {
    entries.sort((a, b) => a.number - b.number || a.numberStr.localeCompare(b.numberStr));
    const usedNumbers = Array.from(new Set(entries.map((entry) => entry.number))).sort((a, b) => a - b);
    const min = usedNumbers[0] ?? 0;
    const max = usedNumbers[usedNumbers.length - 1] ?? 0;
    const usedSet = new Set(usedNumbers);
    const gaps: number[] = [];
    if (max - min <= MAX_GAP_RANGE) {
      for (let n = min + 1; n < max; n++) {
        if (!usedSet.has(n)) gaps.push(n);
      }
    }
    const numberWidth = entries.reduce((width, entry) => Math.max(width, entry.numberStr.length), 1);
    const codeCounts = new Map<string, number>();
    for (const entry of entries) {
      codeCounts.set(entry.item.reportCode, (codeCounts.get(entry.item.reportCode) ?? 0) + 1);
    }
    const duplicateCodes = new Set(Array.from(codeCounts.entries()).filter(([, count]) => count > 1).map(([code]) => code));
    const rangeMax = Math.max(999, Number("9".repeat(numberWidth)));
    groups.push({ prefix, items: entries.map((entry) => entry.item), usedNumbers, min, max, gaps, numberWidth, rangeMax, duplicateCodes });
  }
  return groups.sort((a, b) => a.prefix.localeCompare(b.prefix));
}

export function groupByWorkspace(items: PowerBiItem[]): WorkspaceGroup[] {
  const byWorkspace = new Map<string, PowerBiItem[]>();
  for (const item of items) {
    const bucket = byWorkspace.get(item.workspaceId) ?? [];
    bucket.push(item);
    byWorkspace.set(item.workspaceId, bucket);
  }

  const groups: WorkspaceGroup[] = [];
  for (const [workspaceId, workspaceItems] of byWorkspace) {
    const workspaceName = (workspaceItems[0]?.workspaceName || workspaceId).trim();
    const coded = workspaceItems.filter((item) => item.reportCode);
    const uncoded = workspaceItems.filter((item) => !item.reportCode);
    groups.push({ workspaceId, workspaceName, items: workspaceItems, seriesGroups: groupByCodeSeries(coded), uncoded });
  }
  return groups.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
}

export function padCodeNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatNumberRanges(numbers: number[], width: number, maxRanges = 10): string {
  if (!numbers.length) return "";
  const ranges: string[] = [];
  let start = numbers[0]!;
  let prev = numbers[0]!;
  for (let i = 1; i <= numbers.length; i++) {
    const current = numbers[i];
    if (current !== undefined && current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? padCodeNumber(start, width) : `${padCodeNumber(start, width)}-${padCodeNumber(prev, width)}`);
    if (current !== undefined) {
      start = current;
      prev = current;
    }
  }
  if (ranges.length > maxRanges) {
    return `${ranges.slice(0, maxRanges).join(", ")}, +${ranges.length - maxRanges} more`;
  }
  return ranges.join(", ");
}

export const SITE_GROUP_KEYS = ["PKT", "BPK", "BSI", "DBK", "Other"] as const;
export type SiteGroupKey = (typeof SITE_GROUP_KEYS)[number];

const KNOWN_SITE_PREFIXES = new Set(SITE_GROUP_KEYS.slice(0, -1));

export function siteGroupKeyForWorkspace(workspaceName: string): SiteGroupKey {
  const match = workspaceName.trim().match(/^([A-Za-z]{2,4})\s*\|/);
  const prefix = match?.[1]?.toUpperCase();
  return prefix && KNOWN_SITE_PREFIXES.has(prefix as SiteGroupKey) ? (prefix as SiteGroupKey) : "Other";
}

function extractWorkspaceAbbrev(workspaceName: string): string | null {
  const match = workspaceName.trim().match(/\(([A-Za-z0-9]+)\)\s*$/);
  return match?.[1]?.toUpperCase() ?? null;
}

export function expectedCodePrefixForWorkspace(workspaceName: string): string | null {
  const siteKey = siteGroupKeyForWorkspace(workspaceName);
  if (siteKey === "Other") return null;
  const abbrev = extractWorkspaceAbbrev(workspaceName);
  return abbrev ? `${siteKey}-${abbrev}` : null;
}

export function isCodeMismatch(item: { workspaceName: string; reportCode: string }): boolean {
  if (!item.reportCode) return false;
  const expected = expectedCodePrefixForWorkspace(item.workspaceName);
  if (!expected) return false;
  const parsed = splitCode(item.reportCode);
  return (parsed?.prefix ?? null) !== expected;
}

export type SiteGroup = {
  key: SiteGroupKey;
  workspaces: WorkspaceGroup[];
  itemCount: number;
};

export function groupBySiteGroup(workspaceGroups: WorkspaceGroup[]): SiteGroup[] {
  const byKey = new Map<SiteGroupKey, WorkspaceGroup[]>();
  for (const group of workspaceGroups) {
    const key = siteGroupKeyForWorkspace(group.workspaceName);
    const bucket = byKey.get(key) ?? [];
    bucket.push(group);
    byKey.set(key, bucket);
  }
  const result: SiteGroup[] = [];
  for (const key of SITE_GROUP_KEYS) {
    const workspaces = byKey.get(key);
    if (!workspaces?.length) continue;
    result.push({ key, workspaces, itemCount: workspaces.reduce((sum, w) => sum + w.items.length, 0) });
  }
  return result;
}
