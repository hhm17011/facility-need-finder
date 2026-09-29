import { EvidenceType } from '../../../evidenceTypes';
import { evaluationConfig } from './config';
import { publicationTime } from './deterministic';
import type { EvaluatedEvidenceItem, EvidenceSort, QualityFilter } from './types';
const compareStrength = (a: EvaluatedEvidenceItem, b: EvaluatedEvidenceItem) =>
  (b.evidenceStrength ?? -1) - (a.evidenceStrength ?? -1) || b.evaluationCompleteness.available - a.evaluationCompleteness.available;
export function sortEvidence(items: EvaluatedEvidenceItem[], order: EvidenceSort): EvaluatedEvidenceItem[] {
  const categories = Object.values(EvidenceType);
  return [...items].sort((a, b) => {
    if (order === 'newest') {
      const date = (item: EvaluatedEvidenceItem) => { const parsed = publicationTime(item.publishedDate); return parsed !== null && parsed <= new Date(item.analyzedAt).getTime() ? parsed : -Infinity; };
      const difference = date(b) - date(a);
      if (difference && !Number.isNaN(difference)) return difference;
    }
    if (order === 'category') { const difference = categories.indexOf(a.category) - categories.indexOf(b.category); if (difference) return difference; }
    return compareStrength(a, b);
  });
}
export function matchesQuality(item: EvaluatedEvidenceItem, filter: QualityFilter) {
  if (filter === 'strong') return item.strengthLabel === '강한 근거';
  if (filter === 'direct') return item.evidenceRole === 'DIRECT';
  if (filter === 'regional') return item.regionalLevel === 'local' || item.regionalLevel === 'provincial';
  return true;
}
export function summarizeAnalysis(items: EvaluatedEvidenceItem[]) {
  return { total: items.length, strong: items.filter(item => item.strengthLabel === '강한 근거').length,
    directRegional: items.filter(item => item.evidenceRole === 'DIRECT' && matchesQuality(item, 'regional')).length,
    contextual: items.filter(item => item.evidenceRole === 'CONTEXT').length,
    insufficient: items.filter(item => item.strengthLabel === '평가 정보 부족').length,
    unresolvedRole: items.filter(item => item.evidenceRole === 'UNKNOWN').length };
}
export function selectTopEvidence(items: EvaluatedEvidenceItem[]): EvaluatedEvidenceItem[] {
  const rules = evaluationConfig.top;
  const remaining = sortEvidence(items.filter(item => item.evidenceStrength !== null && item.evidenceStrength >= rules.minimumScore && item.evaluationCompleteness.available >= rules.minimumDimensions), 'strength');
  const selected: EvaluatedEvidenceItem[] = [];
  const seenCategories = new Set<EvidenceType>();
  // Diversity only within a narrow quality band; no low-quality category quotas.
  while (remaining.length && selected.length < rules.limit) {
    const floor = remaining[0].evidenceStrength! - rules.diversityTolerance;
    let index = remaining.findIndex(item => item.evidenceStrength! >= floor && item.categories.some(category => !seenCategories.has(category)));
    if (index < 0) index = 0;
    const [item] = remaining.splice(index, 1); selected.push(item);
    item.categories.forEach(category => seenCategories.add(category));
  }
  return selected;
}
