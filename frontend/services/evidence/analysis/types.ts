import type { EvidenceItem, EvidenceSearchPlan, FacilityProfile } from '../../../evidenceTypes';
export type EvaluationDimension = 'reliability' | 'relevance' | 'recency' | 'regionalSpecificity' | 'specificity';
export interface DimensionAssessment {
  score: number | null;
  status: 'evaluated' | 'unknown' | 'requires_semantic_analysis' | 'requires_source_verification';
  reason: string;
  method: 'deterministic' | 'semantic' | 'unresolved';
  signals: string[];
}
export type EvidenceWeightConfig = Record<EvaluationDimension, number>;
export type EvidenceRole = 'DIRECT' | 'CONTEXT' | 'UNKNOWN';
export type EvidenceStance = 'SUPPORTS_NEED' | 'WEAKENS_NEED' | 'NEUTRAL' | 'UNKNOWN';
export type RegionalLevel = 'local' | 'provincial' | 'national' | 'unknown';
export interface SemanticAssessment {
  relevance: DimensionAssessment;
  evidenceRole: EvidenceRole;
  roleReason: string;
  stance: EvidenceStance;
  stanceReason: string;
  /** Semantic judgments must point to a literal retrieved passage, not generated text. */
  supportingPassages: { field: 'title' | 'snippet'; quote: string }[];
}
export type SemanticAnalyzer = (input: { evidence: Readonly<EvidenceItem>; facility: Readonly<FacilityProfile>; plan?: Readonly<EvidenceSearchPlan> }) => SemanticAssessment;
export interface EvaluatedEvidenceItem extends Omit<EvidenceItem, 'evaluation'> {
  evaluation: Record<EvaluationDimension, DimensionAssessment>;
  evidenceStrength: number | null;
  strengthLabel: '강한 근거' | '보조 근거' | '참고 자료' | '평가 정보 부족';
  evaluationCompleteness: { available: number; total: number };
  strengthCalculation: {
    weightedSum: number;
    weightSum: number;
    weights: EvidenceWeightConfig;
    included: EvaluationDimension[];
    missing: EvaluationDimension[];
    excludedByWeight: EvaluationDimension[];
    method: 'equal_available_mean' | 'configured_available_mean';
  };
  evidenceRole: EvidenceRole;
  roleReason: string;
  stance: EvidenceStance;
  stanceReason: string;
  regionalLevel: RegionalLevel;
  matchingTerms: string[];
  analysisDepth: 'search_result_only' | 'metadata_only' | 'document_fetched' | 'document_parsed';
  analysisVersion: string;
  analyzedAt: string;
}
export interface AnalyzerOptions {
  referenceDate?: string;
  weights?: EvidenceWeightConfig;
  semanticAnalyzer?: SemanticAnalyzer;
}
export type EvidenceSort = 'strength' | 'newest' | 'category';
export type QualityFilter = 'all' | 'strong' | 'direct' | 'regional';
