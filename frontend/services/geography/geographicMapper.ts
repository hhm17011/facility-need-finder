import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { canonicalUrl } from '../evidence/evidenceNormalizer';
import { normalizeRegion, referencesInText } from './regionNormalizer';
import { scoreRegion } from './candidateScore';
import type { GeographicResult, RegionMapping } from './types';
export function mapGeographicEvidence(input: EvaluatedEvidenceItem[], mode: 'demo' | 'live'): GeographicResult {
  const unique = new Map<string, EvaluatedEvidenceItem>();
  for (const item of input.filter(item => item.mode === mode)) {
    const key = item.url ? `${mode}:${canonicalUrl(item.url) ?? item.id}` : item.id;
    if (!unique.has(key)) unique.set(key, item);
  }
  const items = [...unique.values()];
  const result: GeographicResult = { mode, mappings: [], profiles: [], candidates: [], nationalContext: [], unresolved: [] };
  for (const item of items) {
    const fields = [
      { field: '제목', text: item.title }, { field: '검색 스니펫', text: item.snippet },
      ...item.extractedClaims.filter(claim => claim.sourceExcerpt.trim()).map(claim => ({ field: '추출 원문 발췌', text: claim.sourceExcerpt })),
      ...item.quantitativeEvidence.filter(value => value.sourceExcerpt.trim()).map(value => ({ field: '수치 원문 발췌', text: value.sourceExcerpt })),
    ];
    const scope = normalizeRegion(item.geographicScope);
    if (scope.normalizationStatus === 'matched') fields.push({ field: '제공된 지리 범위', text: item.geographicScope });
    const found: RegionMapping[] = fields.flatMap(({ field, text }) => referencesInText(text).map(region => ({ evidenceId: item.id, region, confidence: region.confidence, field, quote: text, role: 'UNKNOWN' as const, mappingReason: `${field}에 ‘${region.rawText}’가 명시됨. 발행기관·도메인으로 위치를 추론하지 않음.` })));
    if (scope.normalizationStatus === 'national') found.push({ evidenceId: item.id, region: scope, confidence: scope.confidence, field: '제공된 지리 범위', quote: item.geographicScope, role: 'UNKNOWN', mappingReason: '제공된 지리 범위가 전국으로 명시됨.' });
    const ambiguous = found.filter(mapping => mapping.region.normalizationStatus === 'ambiguous');
    if (ambiguous.length) result.unresolved.push({ evidence: item, references: ambiguous.map(mapping => mapping.region), reason: '동일 지명 후보가 여럿이어서 해당 표기를 후보 점수에서 제외했습니다. 가능한 지역 목록은 일부 예시입니다.' });
    const national = found.find(mapping => mapping.region.normalizationStatus === 'national');
    if (national) { result.nationalContext.push(item); result.mappings.push({ ...national, role: 'NATIONAL_CONTEXT' }); }
    let matched = found.filter(mapping => mapping.region.normalizationStatus === 'matched');
    // Explicit national scope takes precedence. Otherwise preserve only explicitly named regions.
    if (scope.normalizationStatus === 'national') matched = [];
    const distinct = [...new Map(matched.map(mapping => [mapping.region.id, mapping])).values()];
    const leaves = distinct.filter(parent => !distinct.some(child => child.region.id !== parent.region.id && child.region.displayName.startsWith(`${parent.region.displayName} `)));
    for (const mapping of leaves) result.mappings.push({ ...mapping, role: item.evidenceRole === 'CONTEXT' ? 'REGION_CONTEXT' : item.evidenceRole === 'DIRECT' && leaves.length === 1 ? 'REGION_DIRECT' : 'UNKNOWN', mappingReason: `${mapping.mappingReason}${leaves.length > 1 ? ' 복수 지역 자료이므로 각 지역의 직접 수요 근거로 단정하지 않음.' : ''}` });
    if (!found.length) result.unresolved.push({ evidence: item, references: item.mentionedRegions.map(region => ({ ...normalizeRegion(region.name), id: null, normalizationStatus: 'unknown', confidence: 0 })), reason: item.mentionedRegions.length ? '지명 메타데이터가 있지만 제목·스니펫·원문 발췌에서 뒷받침되는 지역 표기를 확인하지 못했습니다.' : '지원하는 명시 지명을 확인하지 못했습니다. 미등록 지역 또는 지리 정보가 없는 자료입니다.' });
  }
  const regionIds = [...new Set(result.mappings.filter(mapping => mapping.region.normalizationStatus === 'matched').map(mapping => mapping.region.id))];
  result.profiles = regionIds.map(id => {
    const mappings = result.mappings.filter(mapping => mapping.region.id === id);
    const evidenceIds = new Set(mappings.map(mapping => mapping.evidenceId));
    return scoreRegion(mappings[0].region, items.filter(item => evidenceIds.has(item.id)), mappings, mode);
  });
  result.candidates = result.profiles.filter(profile => profile.candidateScore !== null).sort((a, b) => b.candidateScore! - a.candidateScore! || a.region.displayName.localeCompare(b.region.displayName, 'ko'));
  result.candidates.forEach((profile, index) => { profile.rank = index + 1; });
  return result;
}
