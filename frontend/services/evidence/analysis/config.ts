import type { EvaluationDimension, EvidenceWeightConfig } from './types';
export const dimensionLabels: Record<EvaluationDimension, string> = {
  reliability: '신뢰성', relevance: '관련성', recency: '최신성', regionalSpecificity: '지역 구체성', specificity: '근거 구체성',
};
export const dimensions = Object.keys(dimensionLabels) as EvaluationDimension[];
export const defaultWeights: EvidenceWeightConfig = { reliability: 1, relevance: 1, recency: 1, regionalSpecificity: 1, specificity: 1 };
/** Transparent prototype heuristics, not statistically or expert validated weights. */
export const evaluationConfig = {
  version: 'metadata-rules-v1',
  reliability: { organization: 50, siteLabel: 30, url: 10, officialDomain: 10, dated: 5, methodology: 10, cap: 85 },
  regional: { local: 90, provincial: 60, national: 25 },
  specificity: { narrative: 15, quantity: 25, sample: 20, comparison: 20, explicitStatement: 15, promotionalPenalty: 15, minimumTextLength: 12, cap: 95 },
  recency: {
    timeSensitive: [[1, 100], [3, 75], [5, 50], [Infinity, 25]],
    research: [[2, 100], [5, 85], [10, 70], [Infinity, 55]],
    general: [[2, 100], [5, 75], [10, 50], [Infinity, 30]],
  },
  labels: { minimumDimensions: 3, strongMinimumDimensions: 4, strongScore: 75, supportingScore: 55 },
  top: { limit: 5, minimumScore: 70, minimumDimensions: 4, diversityTolerance: 5 },
} as const;
