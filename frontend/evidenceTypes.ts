export interface FacilityProfile {
  originalInput: string;
  facilityName: string;
  facilityCategory: string;
  primaryUsers: string[];
  relatedUsers: string[];
  mainFunctions: string[];
  problemDomains: string[];
  interpretationStatus: 'matched' | 'needs_clarification';
  interpretationMethod: 'local_rules' | 'ai';
  interpretationNote: string;
  normalizedConcepts?: string[];
  targetUsers?: string[];
  relatedFacilityTerms?: string[];
  demographicConcepts?: string[];
  socialConcepts?: string[];
  spatialConcepts?: string[];
  policyConcepts?: string[];
  demandConcepts?: string[];
  supplyConcepts?: string[];
  researchQuestions?: string[];
}
export type FacilityInterpreter = (input: string) => Promise<FacilityProfile>;
export const EvidenceType = {
  LAW_POLICY: 'LAW_POLICY', RESEARCH: 'RESEARCH', PUBLIC_REPORT: 'PUBLIC_REPORT',
  DEMAND_SURVEY: 'DEMAND_SURVEY', SURVEY: 'SURVEY', STATISTICS: 'STATISTICS', NEWS: 'NEWS',
} as const;
export type EvidenceType = typeof EvidenceType[keyof typeof EvidenceType];
export type SourceType = 'official_law' | 'government_policy' | 'academic_paper' | 'public_institution_report' | 'demand_survey' | 'user_survey' | 'official_statistics' | 'news_article';
export interface PlannedSearch {
  category: EvidenceType;
  query: string;
  purpose: string;
  /** Search order only; never an evidence weight or reliability score. */
  priority: 'normal' | 'high';
  geographicScope: string;
  preferredSourceTypes: SourceType[];
}
export interface EvidenceCategoryPlan {
  type: EvidenceType;
  label: string;
  purpose: string;
  searchTopics: string[];
  plannedSearches: PlannedSearch[];
}
export interface EvidenceSearchPlan {
  phenomenonTopics?: import('./services/issues/types').ExplorationTopic[];
  facility: string;
  geographicScope: string;
  status: 'planned';
  requiresClarification: boolean;
  evidenceCategories: EvidenceCategoryPlan[];
}
export type EvidenceSearchPlanner = (profile: FacilityProfile) => EvidenceSearchPlan;

// #3 discovery values remain null; #4 uses a separate EvaluatedEvidenceItem contract.
export interface EvidenceEvaluation {
  reliability: number | null;
  relevance: number | null;
  recency: number | null;
  regionalSpecificity: number | null;
  specificity: number | null;
}
export interface ExtractedClaim {
  text: string;
  sourceExcerpt: string;
  sourceLocator: string | null; // e.g. page, table, paragraph
  sourcePassage?: string;
  sourceLanguage?: 'ko' | 'other';
  matchedConcepts?: string[];
  matchedPhenomena?: string[];
}
export interface QuantitativeEvidence {
  indicator: string;
  value: number;
  unit: string;
  referencePeriod: string | null;
  geographicScope: string;
  sourceExcerpt: string;
  sourceLocator: string | null;
}
export interface EvidenceItem {
  evidenceSummary?: string;
  relevanceReason?: string;
  cleanPassage?: string;
  passageRole?: 'DEMAND'|'SUPPLY'|'SPATIAL'|'POLICY'|'RESEARCH';
  evidenceLevel?: 'DIRECT'|'SUPPORTING'|'CONTEXT';
  sourceYear?: string | null;
  regionalObservations?: import('./services/regional/types').RegionalObservation[];
  id: string;
  category: EvidenceType;
  title: string;
  summary: string;
  sourceOrganization: string | null;
  sourceLabel: string | null; // provider-supplied site label, not a verified organization
  snippet: string;
  provider: string;
  sourceType?: 'LOCAL_PLAN'|'LOCAL_REPORT'|'GOVERNMENT_REPORT'|'PUBLIC_DATA'|'POLICY_RESEARCH'|'ACADEMIC'|'LAW'|'SURVEY'|'NEWS'|'OTHER';
  sourceAuthority?: 'LOCAL_GOVERNMENT'|'REGIONAL_GOVERNMENT'|'NATIONAL_GOVERNMENT'|'PUBLIC_INSTITUTION'|'POLICY_INSTITUTE'|'ACADEMIC'|'NEWS'|'OTHER';
  discoveredProviders?: string[];
  mode: 'demo' | 'live';
  categories: EvidenceType[]; // discovery query categories, not verified source classifications
  discoveryQueries: string[];
  providerDateHint: string | null; // may describe modification rather than publication
  publishedDate: string | null; // null when the original source does not disclose it
  url: string | null; // required for live results; demo cards have no invented URLs
  retrievedAt: string;
  retrievalStatus?: 'SEARCH_RESULT_ONLY' | 'SOURCE_METADATA_ONLY' | 'DOCUMENT_FETCHED' | 'DOCUMENT_PARSED';
  contentStatus?: 'METADATA_ONLY' | 'VERIFIED_HTML' | 'VERIFIED_PDF' | 'CONTENT_UNAVAILABLE' | 'CONTENT_EXTRACTION_LOW_QUALITY' | 'PDF_EXTRACTION_FAILED' | 'NO_RELEVANT_CLAIM';
  rejectionReason?: string;
  authors?: string[];
  geographicScope: string;
  regionEvidenceScope?: 'SIGUNGU_DIRECT' | 'SIDO_CONTEXT' | 'NATIONAL_CONTEXT';
  selectionRegionCode?: string;
  mentionedRegions: { name: string; regionCode: string | null }[];
  extractedClaims: ExtractedClaim[];
  quantitativeEvidence: QuantitativeEvidence[];
  evaluation: EvidenceEvaluation;
}
export interface CandidateRegion {
  regionCode: string | null;
  regionName: string;
  rationale: { text: string; evidenceIds: string[] }[];
  strongestEvidenceIds: string[]; // future selection of 3–5 traceable items; no ranking in #2
}
