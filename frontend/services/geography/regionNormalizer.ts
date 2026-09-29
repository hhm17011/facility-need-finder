import { alwaysAmbiguous, displayName, regionCatalog } from './regionCatalog';
import type { RegionReference } from './types';
const clean = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
export function normalizeRegion(rawText: string): RegionReference {
  const raw = clean(rawText);
  const base: RegionReference = { id: null, regionCode: null, country: '대한민국', level1: null, level2: null, level3: null, displayName: raw, confidence: 0, rawText, normalizationStatus: 'unknown', possibleCandidates: [] };
  if (['전국', '대한민국', '대한민국 전체', '전국 단위', 'NATIONAL'].includes(raw)) return { ...base, id: 'national', displayName: '대한민국 전체', normalizationStatus: 'national', confidence: 1 };
  const matches = regionCatalog.filter(entry => entry.aliases.includes(raw));
  if (alwaysAmbiguous.has(raw) || matches.length > 1) return { ...base, normalizationStatus: 'ambiguous', possibleCandidates: matches.map(displayName) };
  if (!matches.length) return base;
  const found = matches[0];
  return { ...base, id: found.id, level1: found.level1, level2: found.level2, level3: found.level3, displayName: displayName(found), confidence: raw === displayName(found) ? 0.98 : 0.95, normalizationStatus: 'matched' };
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Longest contiguous explicit phrase wins, preventing parent/child double attribution. */
export function referencesInText(text: string): RegionReference[] {
  const normalized = clean(text.replace(/(?:주소|소재지|연락처|발행처|발행기관)\s*[:：][^\n]*/g, ''));
  const aliases = [...new Set([...regionCatalog.flatMap(entry => entry.aliases), ...alwaysAmbiguous, '대한민국 전체', '대한민국', '전국'])].sort((a, b) => b.length - a.length);
  const spans: { start: number; end: number; reference: RegionReference }[] = [];
  for (const alias of aliases) {
    const pattern = new RegExp(`(?<![가-힣A-Za-z0-9])${escape(alias).replace(/ /g, '\\s+')}(?=$|[^가-힣A-Za-z0-9]|에서|에는|으로|와|과|의|은|는|에|을|를)`, 'g');
    for (const match of normalized.matchAll(pattern)) {
      const start = match.index; const end = start + match[0].length;
      if (spans.some(span => start < span.end && end > span.start)) continue;
      // Publisher contact addresses are not evidence about the region's facility need.
      const prefix = normalized.slice(Math.max(0, start - 20), start);
      if (/(주소|소재지|연락처|발행처|발행기관)\s*[:：]\s*$/.test(prefix)) continue;
      spans.push({ start, end, reference: normalizeRegion(match[0]) });
    }
  }
  return spans.sort((a, b) => a.start - b.start).map(span => span.reference);
}
