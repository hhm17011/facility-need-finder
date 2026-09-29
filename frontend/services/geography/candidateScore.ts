import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { candidateDimensionLabels, candidateScoreConfig as config } from './config';
import type { CandidateDimension, RegionEvidenceProfile, RegionMapping, RegionReference } from './types';
const mean = (values: number[]): number | null => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const rounded = (value: number) => Math.round(value * 10) / 10;
const keyText = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
function domain(item: EvaluatedEvidenceItem) {
  if (!item.url) return null;
  try { const host = new URL(item.url).hostname; return host.split('.').slice(/\.(co|go|or|re|ac)\.kr$/.test(host) ? -3 : -2).join('.'); } catch { return null; }
}
/** Group same publisher and same normalized titles; original items remain visible. */
export function representativeSources(items: EvaluatedEvidenceItem[]) {
  const groups: { items: EvaluatedEvidenceItem[]; identities: Set<string>; titles: Set<string> }[] = [];
  for (const item of items) {
    const identities = new Set<string>();
    if (item.sourceOrganization?.trim()) identities.add(`org:${keyText(item.sourceOrganization)}`);
    const host = domain(item); if (host) identities.add(`host:${host}`);
    const title = keyText(item.title);
    const matches = groups.filter(group => [...identities].some(identity => group.identities.has(identity)) || (title.length >= 12 && group.titles.has(title)) || (!identities.size && group.identities.has('unidentified')));
    const group = matches.shift() ?? { items: [], identities: new Set<string>(), titles: new Set<string>() };
    if (!groups.includes(group)) groups.push(group);
    for (const other of matches) { group.items.push(...other.items); other.identities.forEach(identity => group.identities.add(identity)); other.titles.forEach(value => group.titles.add(value)); groups.splice(groups.indexOf(other), 1); }
    group.items.push(item); identities.forEach(identity => group.identities.add(identity)); if (!identities.size) group.identities.add('unidentified'); group.titles.add(title);
  }
  const best = (a: EvaluatedEvidenceItem, b: EvaluatedEvidenceItem) => (b.evidenceStrength ?? -1) - (a.evidenceStrength ?? -1) || b.evaluationCompleteness.available - a.evaluationCompleteness.available;
  const representatives = groups.map(group => ({ item: [...group.items].sort(best)[0], identified: [...group.identities].some(key => key !== 'unidentified') })).sort((a, b) => best(a.item, b.item));
  const counts = new Map<string, number>();
  const capped = representatives.filter(({ item }) => { const count = counts.get(item.category) ?? 0; if (count >= config.perCategoryCap) return false; counts.set(item.category, count + 1); return true; });
  return { capped, identifiedGroups: groups.filter(group => [...group.identities].some(key => key !== 'unidentified')).length };
}
export function scoreRegion(region: RegionReference, items: EvaluatedEvidenceItem[], mappings: RegionMapping[], mode: 'demo' | 'live'): RegionEvidenceProfile {
  const grouped = representativeSources(items);
  const representatives = grouped.capped.map(value => value.item);
  const identified = grouped.capped.filter(value => value.identified).length;
  const categories = new Set(representatives.map(item => item.category));
  const ids = representatives.map(item => item.id);
  const roleOf = (item: EvaluatedEvidenceItem) => mappings.find(mapping => mapping.evidenceId === item.id)?.role ?? 'UNKNOWN';
  const roleKnown = representatives.filter(item => roleOf(item) !== 'UNKNOWN');
  const dimensions: RegionEvidenceProfile['dimensions'] = {
    evidenceStrength: { score: mean(representatives.flatMap(item => item.evidenceStrength === null ? [] : [item.evidenceStrength])), reason: 'URL·출처·동일 제목 중복과 유형 상한을 적용한 대표 자료의 근거 강도 평균입니다.', evidenceIds: representatives.filter(item => item.evidenceStrength !== null).map(item => item.id) },
    directEvidence: { score: roleKnown.length ? roleKnown.filter(item => roleOf(item) === 'REGION_DIRECT').length / roleKnown.length * 100 : null, reason: '역할이 판정된 대표 자료 중 REGION_DIRECT 비율입니다. 미판정을 0점으로 바꾸지 않습니다.', evidenceIds: roleKnown.map(item => item.id) },
    sourceDiversity: { score: identified ? Math.min(identified / config.sourceDiversityTarget, 1) * 100 : null, reason: `상한 적용 후 식별된 출처 그룹 ${identified}개 / 기준 ${config.sourceDiversityTarget}개. 기관·도메인은 독립성의 대리 지표이며 실제 독립성을 검증하지 않았습니다.`, evidenceIds: grouped.capped.filter(value => value.identified).map(value => value.item.id) },
    evidenceDiversity: { score: categories.size ? Math.min(categories.size / config.categoryDiversityTarget, 1) * 100 : null, reason: `대표 자료의 주 탐색 유형 ${categories.size}종 / 기준 ${config.categoryDiversityTarget}종. 한 문서의 중복 분류로 다양성을 늘리지 않습니다.`, evidenceIds: ids },
    regionalSpecificity: { score: region.level2 || region.level3 ? config.specificity.local : config.specificity.provincial, reason: '정규화된 시·군·구 이하는 100, 광역시·도는 60입니다. 실제 입지 적합성을 뜻하지 않습니다.', evidenceIds: ids },
  };
  const included = (Object.keys(dimensions) as CandidateDimension[]).filter(key => dimensions[key].score !== null);
  const weightSum = included.reduce((sum, key) => sum + config.weights[key], 0);
  const weightedSum = included.reduce((sum, key) => sum + dimensions[key].score! * config.weights[key], 0);
  const completeness = mean(representatives.map(item => item.evaluationCompleteness.available / item.evaluationCompleteness.total)) ?? 0;
  const mapping = mean(representatives.map(item => mappings.find(found => found.evidenceId === item.id)?.confidence ?? 0)) ?? 0;
  const signals = { sourceGroups: identified, categories: categories.size, completeness, mapping, roleCoverage: representatives.length ? roleKnown.length / representatives.length : 0, stanceCoverage: representatives.length ? representatives.filter(item => item.stance !== 'UNKNOWN').length / representatives.length : 0, dateCoverage: representatives.length ? representatives.filter(item => item.evaluation.recency.score !== null).length / representatives.length : 0 };
  const warnings: string[] = [];
  if (identified < config.eligibility.sources) warnings.push(`식별 가능한 대표 출처가 ${config.eligibility.sources}개 미만입니다.`);
  if (completeness < config.eligibility.completeness) warnings.push('자료 평가 정보가 부족합니다(대표 자료 평균 완성도 60% 미만).');
  if (mapping < config.eligibility.mapping) warnings.push('지역 표기 정규화 확신도가 충분하지 않습니다.');
  if (included.length < config.eligibility.dimensions || dimensions.evidenceStrength.score === null) warnings.push('후보 점수에 필요한 평가축이 부족합니다.');
  const eligible = !warnings.length;
  const supportsNeed = items.filter(item => item.stance === 'SUPPORTS_NEED');
  const weakensNeed = items.filter(item => item.stance === 'WEAKENS_NEED');
  const context = items.filter(item => !supportsNeed.includes(item) && !weakensNeed.includes(item) && (item.evidenceRole === 'CONTEXT' || item.stance === 'NEUTRAL'));
  const unknownItems = items.filter(item => !supportsNeed.includes(item) && !weakensNeed.includes(item) && !context.includes(item));
  const strongConflicts = weakensNeed.filter(item => item.evidenceStrength !== null && item.evidenceStrength >= config.strongContradiction);
  const meets = (threshold: typeof config.confidence.high | typeof config.confidence.medium) => signals.sourceGroups >= threshold.sources && signals.categories >= threshold.categories && signals.completeness >= threshold.completeness && signals.mapping >= threshold.mapping && signals.roleCoverage >= threshold.roleCoverage && signals.stanceCoverage >= threshold.stanceCoverage && signals.dateCoverage >= threshold.dateCoverage;
  let confidence: RegionEvidenceProfile['confidence'] = !eligible ? 'INSUFFICIENT' : meets(config.confidence.high) ? 'HIGH' : meets(config.confidence.medium) ? 'MEDIUM' : 'LOW';
  const confidenceReasons = [`대표 출처 ${identified}그룹 · 주 유형 ${categories.size}종`, `평균 평가 완성도 ${rounded(completeness * 100)}% · 정규화 확신도 ${rounded(mapping * 100)}%`, `역할 판정 ${rounded(signals.roleCoverage * 100)}% · 수요 방향 판정 ${rounded(signals.stanceCoverage * 100)}% · 최신성 평가 가능 ${rounded(signals.dateCoverage * 100)}%`];
  if (strongConflicts.length) { confidence = confidence === 'HIGH' ? 'MEDIUM' : confidence === 'MEDIUM' ? 'LOW' : confidence; confidenceReasons.push('강한 수요 약화 근거가 있어 확신도를 한 단계 낮춥니다(LOW 이하 유지). 후보 점수에서 일괄 차감하지 않습니다.'); }
  if (!roleKnown.length) warnings.push('지역 직접성은 미판정입니다. 지명 언급만으로 시설 수요를 확정할 수 없습니다.');
  if (!signals.stanceCoverage) warnings.push('수요 지지·약화 여부는 미판정입니다.');
  if (!signals.dateCoverage) warnings.push('최신성을 평가할 발행일 정보가 부족합니다.');
  const reasonItems = [...representatives];
  for (const conflict of strongConflicts) if (!reasonItems.includes(conflict)) reasonItems.push(conflict);
  const selectedReasons = reasonItems.slice(0, config.maximumReasons);
  if (strongConflicts.length && !selectedReasons.some(item => strongConflicts.includes(item))) selectedReasons[selectedReasons.length - 1] = strongConflicts[0];
  const why = selectedReasons.map(item => { const linked = mappings.find(mapping => mapping.evidenceId === item.id)!; return {
    text: `「${item.title}」의 ${linked.field}에서 ‘${linked.region.rawText}’ 표기를 확인했습니다. 근거 강도 ${item.evidenceStrength === null ? '미평가' : item.evidenceStrength.toFixed(1)} · ${linked.role === 'REGION_DIRECT' ? '직접 역할 판정 있음' : linked.role === 'REGION_CONTEXT' ? '맥락 역할 판정 있음' : '직접성 미판정'}. 시설 부족이라는 새 결론을 생성하지 않았습니다.`, evidenceIds: [item.id], quote: linked.quote,
  }; });
  return {
    region, mode, rank: null, evidenceItems: items, mappings, supportsNeed, weakensNeed, context, unknown: unknownItems,
    metrics: { totalEvidence: items.length, strongEvidence: items.filter(item => item.strengthLabel === '강한 근거').length, directEvidence: items.filter(item => roleOf(item) === 'REGION_DIRECT').length, contextEvidence: context.length, supportingEvidence: supportsNeed.length, conflictingEvidence: weakensNeed.length, sourceOrganizations: new Set(items.flatMap(item => item.sourceOrganization?.trim() ? [keyText(item.sourceOrganization)] : [])).size, sourceGroups: grouped.identifiedGroups, evidenceCategories: new Set(items.flatMap(item => item.categories)).size, scoredSources: identified, scoredCategories: categories.size, scoredEvidence: representatives.length, recentEvidence: items.filter(item => (item.evaluation.recency.score ?? -1) >= config.recentScore).length, knownDateEvidence: items.filter(item => item.evaluation.recency.score !== null).length },
    candidateScore: eligible && weightSum ? rounded(weightedSum / weightSum) : null, dimensions,
    calculation: { weightedSum, weightSum, included, weights: { ...config.weights }, evidenceIds: ids, excludedEvidenceIds: items.filter(item => !ids.includes(item.id)).map(item => item.id) },
    candidateScoreExplanation: included.map(key => `${candidateDimensionLabels[key]}: ${rounded(dimensions[key].score!)} · ${dimensions[key].reason}`),
    confidence, confidenceReasons, confidenceSignals: signals,
    contradiction: { status: strongConflicts.length ? 'strong' : weakensNeed.length ? 'present' : items.some(item => item.stance !== 'UNKNOWN') ? 'none_detected' : 'unknown', evidenceIds: weakensNeed.map(item => item.id), strongEvidenceIds: strongConflicts.map(item => item.id) },
    warnings, why,
  };
}
