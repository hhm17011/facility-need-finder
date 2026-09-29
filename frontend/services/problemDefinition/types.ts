import type { ArchitecturalIssue } from '../issues/types';
import type { FacilityProfile, EvidenceType } from '../../evidenceTypes';
import type { EvaluatedEvidenceItem, EvidenceRole, EvidenceStance } from '../evidence/analysis/types';
import type { RegionEvidenceProfile, RegionReference } from '../geography/types';
export type ClaimType = 'FACILITY_NEED' | 'DEMOGRAPHIC_CHANGE' | 'SUPPLY_SHORTAGE' | 'ACCESSIBILITY' | 'USER_DEMAND' | 'POLICY_CONTEXT' | 'SOCIAL_CHANGE' | 'REGIONAL_CHANGE' | 'CONTRADICTORY_SIGNAL' | 'OTHER';
export interface EvidenceClaim {
  id: string; claim: string; claimType: ClaimType; evidenceIds: string[];
  region: RegionReference | null; scope: 'NATIONAL' | 'REGIONAL' | 'UNKNOWN';
  strength: number | null; role: EvidenceRole; stance: EvidenceStance;
  quantitativeValues: string[]; sourceCount: number; conflictingEvidenceIds: string[];
  passages: { evidenceId: string; field: string; quote: string; locator: string | null }[];
  status: 'extracted' | 'metadata_only'; usable: boolean;
  calculation: { dimensions: Record<string, number | null>; representativeIds: string[]; method: string };
  limitations: string[];
}
export type SectionKey = 'background' | 'phenomena' | 'architecturalIssue' | 'regionalExpression' | 'designQuestion';
export interface ProblemSection {
  headline: string; body: string; claimIds: string[]; evidenceIds: string[];
  status: 'supported' | 'limited' | 'question';
  statements: { text: string; claimIds: string[]; evidenceIds: string[] }[];
}
export interface ProblemInput {
  facility: FacilityProfile; issue: ArchitecturalIssue; region: RegionEvidenceProfile | null;
  nationalContext: EvaluatedEvidenceItem[]; mode: 'demo' | 'live'; referenceDate?: string;
}
export interface ProblemDefinition {
  facility: FacilityProfile; issue: ArchitecturalIssue; region: RegionReference | null; mode: 'demo' | 'live'; generatedAt: string;
  sections: Record<SectionKey, ProblemSection>; claims: EvidenceClaim[];
  supportingClaims: string[]; contradictoryClaims: string[];
  evidenceItems: EvaluatedEvidenceItem[]; limitations: string[];
  gaps: { unsupportedSections: SectionKey[]; lowConfidenceClaims: string[]; missingCategories: EvidenceType[]; regionalEvidenceGaps: string[]; outdatedEvidence: string[]; undatedEvidence: string[] };
}
export interface SectionDraft { headline: string; body: string; userEdited: boolean }
