import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
export interface RegionReference {
  id: string | null; // local canonical key, NOT an official administrative code
  regionCode: string | null;
  country: '대한민국';
  level1: string | null;
  level2: string | null;
  level3: string | null;
  displayName: string;
  confidence: number;
  rawText: string;
  normalizationStatus: 'matched' | 'ambiguous' | 'unknown' | 'national';
  possibleCandidates: string[];
}
export type GeographicRole = 'REGION_DIRECT' | 'REGION_CONTEXT' | 'NATIONAL_CONTEXT' | 'UNKNOWN';
export interface RegionMapping {
  evidenceId: string;
  region: RegionReference;
  confidence: number;
  mappingReason: string;
  field: string;
  quote: string;
  role: GeographicRole;
}
export type CandidateDimension = 'evidenceStrength' | 'directEvidence' | 'sourceDiversity' | 'evidenceDiversity' | 'regionalSpecificity';
export interface CandidateDimensionScore { score: number | null; reason: string; evidenceIds: string[] }
export interface RegionEvidenceProfile {
  demographicMetrics?:import('../demographics/types').DemographicMetric[];
  demographicPositions?:import('../demographics/types').RelativePosition[];
  demographicPhenomena?:import('../issues/types').Phenomenon[];
  facilitySupplyMetrics?:import('../dataProviders/facilitySupply').FacilitySupplyMetric[];
  demandSupplyIndicators?:import('../dataProviders/facilitySupply').DemandSupplyIndicator[];
  demandSupplyRelationships?:import('../dataProviders/facilitySupply').DemandSupplyRelationship[];
  facilityRecords?:import('../dataProviders/facilitySupply').FacilityRecord[];
  facilityDataCoverage?:{available:number;requested:number;status:string};
  facilityDataGaps?:string[];
  facilityDataQuality?:import('../dataProviders/facilitySupply').FacilityDataQuality[];
  supplyRelativePositions?:import('../dataProviders/facilitySupply').SupplyRelativePosition[];
  demandSupplyCompatibility?:ReturnType<typeof import('../dataProviders/facilitySupply').demandSupplyCompatibility>;
  regionalAssessment?: import('../regional/types').RegionalAssessment;
  region: RegionReference;
  mode: 'demo' | 'live';
  rank: number | null;
  evidenceItems: EvaluatedEvidenceItem[];
  mappings: RegionMapping[];
  supportsNeed: EvaluatedEvidenceItem[];
  weakensNeed: EvaluatedEvidenceItem[];
  context: EvaluatedEvidenceItem[];
  unknown: EvaluatedEvidenceItem[];
  metrics: {
    totalEvidence: number; strongEvidence: number; directEvidence: number; contextEvidence: number;
    supportingEvidence: number; conflictingEvidence: number; sourceOrganizations: number;
    sourceGroups: number; evidenceCategories: number; scoredSources: number; scoredCategories: number;
    scoredEvidence: number; recentEvidence: number; knownDateEvidence: number;
  };
  candidateScore: number | null;
  dimensions: Record<CandidateDimension, CandidateDimensionScore>;
  calculation: { weightedSum: number; weightSum: number; included: CandidateDimension[]; weights: Record<CandidateDimension, number>; evidenceIds: string[]; excludedEvidenceIds: string[] };
  candidateScoreExplanation: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  confidenceReasons: string[];
  confidenceSignals: { sourceGroups: number; categories: number; completeness: number; mapping: number; roleCoverage: number; stanceCoverage: number; dateCoverage: number };
  contradiction: { status: 'unknown' | 'none_detected' | 'present' | 'strong'; evidenceIds: string[]; strongEvidenceIds: string[] };
  warnings: string[];
  why: { text: string; evidenceIds: string[]; quote: string }[];
}
export interface GeographicResult {
  mode: 'demo' | 'live';
  mappings: RegionMapping[];
  profiles: RegionEvidenceProfile[];
  candidates: RegionEvidenceProfile[];
  nationalContext: EvaluatedEvidenceItem[];
  unresolved: { evidence: EvaluatedEvidenceItem; references: RegionReference[]; reason: string }[];
}
