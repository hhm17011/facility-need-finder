import type { EvidenceItem, EvidenceSearchPlan, FacilityProfile } from '../../../evidenceTypes';
import { unknown } from './deterministic';
import type { SemanticAnalyzer, SemanticAssessment } from './types';
export function unresolvedSemantics(reason = '의미 분석기가 연결되지 않았습니다. 단어 일치만으로 시설 관련성·직접성·수요 방향을 판단하지 않습니다.'): SemanticAssessment {
  return { relevance: unknown(reason, 'requires_semantic_analysis'), evidenceRole: 'UNKNOWN', roleReason: '현재 설계 문제에 대한 직접 근거인지 맥락인지 미판정입니다.', stance: 'UNKNOWN', stanceReason: '시설 수요를 지지·약화하는지 미판정이며 모든 자료를 보존합니다.', supportingPassages: [] };
}
export function matchingTerms(item: EvidenceItem, profile: FacilityProfile, plan?: EvidenceSearchPlan): string[] {
  const text = `${item.title} ${item.snippet}`.replace(/\s+/g, '').toLowerCase();
  const terms = [profile.facilityName, ...profile.primaryUsers, ...profile.relatedUsers, ...profile.mainFunctions, ...profile.problemDomains,
    ...(plan?.evidenceCategories.flatMap(category => category.searchTopics) ?? [])];
  return [...new Set(terms.filter(term => term.trim().length >= 2 && text.includes(term.replace(/\s+/g, '').toLowerCase())))];
}
/** No external LLM calls in #4. A future adapter must provide retrieved supporting passages. */
export function evaluateSemantics(item: EvidenceItem, profile: FacilityProfile, plan?: EvidenceSearchPlan, adapter?: SemanticAnalyzer): SemanticAssessment {
  if (!adapter) return unresolvedSemantics();
  try {
    const result = adapter({ evidence: item, facility: profile, plan });
    const validPassages = result.supportingPassages.length > 0 && result.supportingPassages.every(passage =>
      ['title', 'snippet'].includes(passage.field) && passage.quote.trim() && item[passage.field].includes(passage.quote));
    const score = result.relevance.score;
    if (!validPassages || score === null || !Number.isFinite(score) || score < 0 || score > 100 || !result.relevance.reason.trim() || !result.roleReason.trim() || !result.stanceReason.trim() ||
        !['DIRECT', 'CONTEXT', 'UNKNOWN'].includes(result.evidenceRole) || !['SUPPORTS_NEED', 'WEAKENS_NEED', 'NEUTRAL', 'UNKNOWN'].includes(result.stance)) {
      return unresolvedSemantics('의미 분석 응답에 유효한 점수·설명·수집 원문 인용이 없어 판단을 보류합니다.');
    }
    return { ...result, relevance: { ...result.relevance, status: 'evaluated', method: 'semantic', signals: result.supportingPassages.map(passage => passage.quote) } };
  } catch { return unresolvedSemantics('의미 분석을 수행하지 못했습니다. 규칙 기반 평가는 유지합니다.'); }
}
