import type { EvidenceItem } from '../../evidenceTypes';
import type { RawSearchResult, SearchQuery } from './types';
export function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = entity.toLowerCase().startsWith('&#x');
    const code = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/\s+/g, ' ').trim();
}
export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    // Keep meaningful query parameters and SPA route hashes; ignore document anchors.
    if (!/^#!?\//.test(url.hash)) url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}
// Deliberately small literal lexicon. No fuzzy geocoding or inferred region codes.
const regionNames = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도', '용인시', '평택시', '수원시', '성남시', '고양시', '화성시'];
export function extractRegions(text: string): EvidenceItem['mentionedRegions'] {
  return regionNames.filter(name => new RegExp(`(?:^|[^가-힣])${name}(?=$|[^가-힣]|에서|에는|의|은|는|에|와|과)`).test(text))
    .map(name => ({ name, regionCode: null }));
}
function verifiedDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10) ? value : null;
}
export function normalizeEvidence(raw: RawSearchResult, query: SearchQuery): EvidenceItem | null {
  const title = plainText(raw.title);
  const canonical = raw.url ? canonicalUrl(raw.url) : null;
  if (!title || (raw.mode === 'live' && !canonical) || (raw.mode === 'demo' && !raw.demoId)) return null;
  const snippet = plainText(raw.snippet);
  const searchedRegion=query.geographicScope&&!['전국','대한민국'].includes(query.geographicScope)?query.geographicScope:null;const sourceText=`${title} ${snippet}`;const leaf=searchedRegion?.split(/\s+/).at(-1)??'';const sido=searchedRegion?.split(/\s+/)[0]??'';const direct=!!searchedRegion&&(sourceText.includes(searchedRegion)||!!leaf&&sourceText.includes(leaf));const sidoContext=!direct&&!!sido&&sourceText.includes(sido);
  return {
    id: raw.mode === 'demo' ? `demo:${raw.demoId}` : `live:${canonical}`,
    category: query.category, categories: [query.category], discoveryQueries: [query.query],
    title, snippet, summary: '', sourceOrganization: raw.sourceOrganization ? plainText(raw.sourceOrganization) : null,
    sourceLabel: raw.sourceLabel ? plainText(raw.sourceLabel) : null,
    publishedDate: verifiedDate(raw.publishedDate), providerDateHint: raw.providerDateHint ?? null,
    url: raw.mode === 'demo' ? null : raw.url, retrievedAt: raw.retrievedAt, provider: raw.provider, discoveredProviders:[raw.provider], sourceType:raw.sourceType??'OTHER',sourceAuthority:raw.sourceAuthority??'OTHER',mode: raw.mode,
    retrievalStatus: raw.retrievalStatus ?? 'SEARCH_RESULT_ONLY', authors: raw.authors?.map(plainText).filter(Boolean) ?? [],
    geographicScope: searchedRegion?(direct?searchedRegion:sidoContext?sido:'전국 또는 지역 미특정'):'원문 범위 미확인',regionEvidenceScope:searchedRegion?(direct?'SIGUNGU_DIRECT':sidoContext?'SIDO_CONTEXT':'NATIONAL_CONTEXT'):undefined, mentionedRegions: extractRegions(sourceText),
    extractedClaims: [], quantitativeEvidence: [],
    evaluation: { reliability: null, relevance: null, recency: null, regionalSpecificity: null, specificity: null },
  };
}
export function deduplicateEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const results = new Map<string, EvidenceItem>();
  for (const item of items) {
    const key = item.mode === 'live' && item.url ? `live:${canonicalUrl(item.url)}` : item.id;
    const previous = results.get(key);
    if (!previous) { results.set(key, { ...item, categories: [...item.categories], discoveryQueries: [...item.discoveryQueries] }); continue; }
    results.set(key, { ...previous,
      categories: [...new Set([...previous.categories, ...item.categories])],
      discoveryQueries: [...new Set([...previous.discoveryQueries, ...item.discoveryQueries])],
      discoveredProviders: [...new Set([...(previous.discoveredProviders??[previous.provider]), ...(item.discoveredProviders??[item.provider])])],
      mentionedRegions: [...new Map([...previous.mentionedRegions, ...item.mentionedRegions].map(region => [region.name, region])).values()],
    });
  }
  return [...results.values()];
}
