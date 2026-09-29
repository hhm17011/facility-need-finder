import type { CandidateDimension } from './types';
export const candidateDimensionLabels: Record<CandidateDimension, string> = { evidenceStrength: '근거 강도', directEvidence: '직접성', sourceDiversity: '출처 다양성', evidenceDiversity: '자료 다양성', regionalSpecificity: '지역 구체성' };
export const candidateScoreConfig = {
  weights: { evidenceStrength: 1, directEvidence: 1, sourceDiversity: 1, evidenceDiversity: 1, regionalSpecificity: 1 },
  perCategoryCap: 2,
  sourceDiversityTarget: 3, categoryDiversityTarget: 4,
  specificity: { local: 100, provincial: 60 },
  eligibility: { sources: 2, completeness: 0.6, mapping: 0.85, dimensions: 3 },
  confidence: {
    high: { sources: 4, categories: 3, completeness: 0.8, mapping: 0.95, roleCoverage: 0.8, stanceCoverage: 0.8, dateCoverage: 0.5 },
    medium: { sources: 2, categories: 2, completeness: 0.6, mapping: 0.9, roleCoverage: 0.5, stanceCoverage: 0.5, dateCoverage: 0.25 },
  },
  strongContradiction: 75, recentScore: 75, maximumReasons: 5,
} as const;
