import type { EvidenceItem, EvidenceSearchPlan, FacilityProfile } from '../../../evidenceTypes';
import { deduplicateEvidence } from '../evidenceNormalizer';
import { defaultWeights, dimensions, evaluationConfig } from './config';
import { evaluateRecency, evaluateRegion, evaluateReliability, evaluateSpecificity } from './deterministic';
import { evaluateSemantics, matchingTerms } from './semantic';
import type { AnalyzerOptions, DimensionAssessment, EvaluatedEvidenceItem, EvaluationDimension, EvidenceWeightConfig } from './types';
export function calculateStrength(evaluation: Record<EvaluationDimension, DimensionAssessment>, weights: EvidenceWeightConfig = defaultWeights) {
  const usableWeights = Object.fromEntries(dimensions.map(key => [key, Number.isFinite(weights[key]) && weights[key] >= 0 ? weights[key] : defaultWeights[key]])) as EvidenceWeightConfig;
  const available = dimensions.filter(key => evaluation[key].status === 'evaluated' && evaluation[key].score !== null && Number.isFinite(evaluation[key].score) && evaluation[key].score! >= 0 && evaluation[key].score! <= 100);
  const included = available.filter(key => usableWeights[key] > 0);
  const weightedSum = included.reduce((sum, key) => sum + evaluation[key].score! * usableWeights[key], 0);
  const weightSum = included.reduce((sum, key) => sum + usableWeights[key], 0);
  return {
    evidenceStrength: weightSum ? Math.round(weightedSum / weightSum * 10) / 10 : null,
    evaluationCompleteness: { available: available.length, total: dimensions.length },
    strengthCalculation: { weightedSum, weightSum, weights: usableWeights, included, missing: dimensions.filter(key => !available.includes(key)), excludedByWeight: available.filter(key => !included.includes(key)),
      method: (dimensions.every(key => usableWeights[key] === 1) ? 'equal_available_mean' : 'configured_available_mean') as EvaluatedEvidenceItem['strengthCalculation']['method'] },
  };
}
function label(strength: number | null, available: number): EvaluatedEvidenceItem['strengthLabel'] {
  const rules = evaluationConfig.labels;
  if (strength === null || available < rules.minimumDimensions) return '평가 정보 부족';
  if (strength >= rules.strongScore && available >= rules.strongMinimumDimensions) return '강한 근거';
  return strength >= rules.supportingScore ? '보조 근거' : '참고 자료';
}
export function analyzeEvidence(item: EvidenceItem, profile: FacilityProfile, plan?: EvidenceSearchPlan, options: AnalyzerOptions = {}): EvaluatedEvidenceItem {
  const reference = options.referenceDate ? new Date(options.referenceDate) : new Date();
  if (!Number.isFinite(reference.getTime())) throw new Error('유효한 평가 기준일이 필요합니다.');
  const semantic = evaluateSemantics(item, profile, plan, options.semanticAnalyzer);
  const region = evaluateRegion(item);
  const evaluation = {
    reliability: evaluateReliability(item, reference.getTime()), relevance: semantic.relevance,
    recency: evaluateRecency(item, reference.getTime()), regionalSpecificity: region.assessment, specificity: evaluateSpecificity(item),
  };
  const strength = calculateStrength(evaluation, options.weights);
  return {
    ...item, evaluation, ...strength,
    strengthLabel: label(strength.evidenceStrength, strength.evaluationCompleteness.available),
    evidenceRole: semantic.evidenceRole, roleReason: semantic.roleReason, stance: semantic.stance, stanceReason: semantic.stanceReason,
    regionalLevel: region.level, matchingTerms: matchingTerms(item, profile, plan),
    analysisDepth: item.retrievalStatus==='DOCUMENT_PARSED'?'document_parsed':item.retrievalStatus==='DOCUMENT_FETCHED'?'document_fetched':item.retrievalStatus==='SOURCE_METADATA_ONLY'?'metadata_only':'search_result_only',
    analysisVersion: evaluationConfig.version, analyzedAt: reference.toISOString(),
  };
}
export function analyzeEvidenceCollection(items: EvidenceItem[], profile: FacilityProfile, plan?: EvidenceSearchPlan, options: AnalyzerOptions = {}): EvaluatedEvidenceItem[] {
  const referenceDate = options.referenceDate ?? new Date().toISOString();
  return deduplicateEvidence(items).map(item => analyzeEvidence(item, profile, plan, { ...options, referenceDate }));
}
