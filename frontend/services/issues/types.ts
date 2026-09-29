import type { RegionReference } from '../geography/types';
export type PhenomenonCategory = 'SOCIAL' | 'DEMOGRAPHIC' | 'URBAN' | 'FACILITY' | 'SPATIAL' | 'USER' | 'POLICY' | 'ECONOMIC' | 'ENVIRONMENTAL' | 'OTHER';
export type IssueConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export interface ExplorationTopic { id: string; category: PhenomenonCategory; question: string; queries: string[] }
export interface Phenomenon {
  id: string; title: string; category: PhenomenonCategory; description: string;
  direction: 'INCREASE' | 'DECREASE' | 'STABLE' | 'CHANGE' | 'UNKNOWN';
  keywords: string[]; relatedFacility: string; affectedUsers: string[];
  evidenceIds: string[]; regions: RegionReference[]; confidence: number | null;
  scope: 'NATIONAL' | 'REGIONAL' | 'UNKNOWN';
  passages: { evidenceId: string; field: string; quote: string }[];
  status: 'extracted' | 'metadata_only' | 'demo';
}
export interface PhenomenonRelationship {
  id: string; phenomenonA: string; phenomenonB: string;
  relationshipType: 'SUPPLY_DEMAND_DIVERGENCE' | 'SUPPLY_GROWTH_WITH_DEMAND_GROWTH' | 'SUPPLY_DECLINE_WITH_DEMAND_DECLINE' | 'SUPPLY_DECLINE_WITH_STABLE_DEMAND' | 'POSSIBLE_OVERSUPPLY' | 'INSUFFICIENT_DATA' | 'CORRELATION' | 'MISMATCH' | 'GAP' | 'CONFLICT' | 'SEQUENCE' | 'COEXISTENCE' | 'POSSIBLE_CAUSAL_LINK' | 'UNKNOWN';
  description: string; evidenceIds: string[]; confidence: number | null; regions: RegionReference[];
  explicit: boolean; passages: { evidenceId: string; quote: string }[];
}
export type IssueType = 'SUPPLY_DEMAND_MISMATCH' | 'SPATIAL_MISMATCH' | 'ACCESSIBILITY_GAP' | 'DEMOGRAPHIC_TRANSITION' | 'URBAN_GROWTH_LAG' | 'FACILITY_DECLINE' | 'PROGRAM_MISMATCH' | 'LIFECYCLE_MISMATCH' | 'ADAPTIVE_REUSE_OPPORTUNITY' | 'SERVICE_GAP' | 'OTHER';
export interface ArchitecturalIssue {
  id: string; title: string; summary: string; issueType: IssueType;
  phenomenonIds: string[]; relationshipIds: string[]; evidenceIds: string[];
  relatedRegions: RegionReference[]; architecturalRelevance: string; dimensions: string[];
  confidence: IssueConfidence; limitations: string[]; conflictingEvidenceIds: string[];
  mode: 'demo' | 'live';
  confidenceCalculation: { sourceGroups: number; evidenceStrength: number | null; phenomenonConfidence: number | null; relationshipConfidence: number | null; sourceCategories: number; regionalEvidence: boolean };
}
export interface IssueAnalysis { phenomena: Phenomenon[]; relationships: PhenomenonRelationship[]; issues: ArchitecturalIssue[] }
