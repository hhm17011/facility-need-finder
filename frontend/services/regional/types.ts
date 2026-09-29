import type { EvidenceType, FacilityProfile } from '../../evidenceTypes';
import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import type { RegionEvidenceProfile, RegionReference } from '../geography/types';
import type { ArchitecturalIssue } from '../issues/types';
export type AdministrativeLevel='NATIONAL'|'SIDO'|'SIGUNGU'|'EUPMYEONDONG'|'UNKNOWN';
export type RegionalDimension='DEMOGRAPHIC_CHANGE'|'URBAN_CHANGE'|'FACILITY_CHANGE'|'DEMAND_SUPPLY'|'SPATIAL_CONDITION'|'DIRECT_LOCAL';
export type GeographicEvidenceRole='DIRECT'|'PARENT_CONTEXT'|'NATIONAL_CONTEXT'|'UNKNOWN';
export interface RegionalEvidenceRequirement {
 id:string;issueId:string;dimension:RegionalDimension;question:string;requiredMetrics:string[];
 preferredAdministrativeLevel:AdministrativeLevel;acceptableAdministrativeLevels:AdministrativeLevel[];
 preferredSourceTypes:EvidenceType[];importance:'required'|'supporting';
}
/** Adapter boundary for genuinely extracted tabular data. Search snippets never populate this automatically. */
export interface RegionalObservation {
 metricId:string;metricType:string;dimension:RegionalDimension|'UNKNOWN';regionName:string;administrativeLevel:AdministrativeLevel;
 value:number|null;unit:string|null;referenceDate:string|null;definition:string|null;populationDefinition:string|null;
 denominator:string|null;boundaryVersion:string|null;sourceExcerpt:string;sourceLocator:string|null;
 verification:'source_verified'|'unverified';
}
export interface RegionalMetric extends RegionalObservation {
 structuredSource?:import("../dataProviders/types").StructuredMetricSource;
 regionCode:string|null;regionId:string|null;sourceEvidenceId:string;sourceUrl:string|null;
 comparisonGroup:string|null;comparable:boolean;limitations:string[];administrativeUnit:string;
}
export interface DerivedIndicator {
 indicator:string;formula:string;inputs:string[];result:number;sourceEvidenceIds:string[];referenceYears:string[];
}
export interface RegionalDataGap {region:string;missingDimension:RegionalDimension|'COMPARABILITY'|'DIRECT_REGIONAL';message:string}
export interface RegionalEvidenceLink {
 evidenceId:string;region:RegionReference|null;administrativeLevel:AdministrativeLevel;
 geographicEvidenceRole:GeographicEvidenceRole;dataKind:'STRUCTURED_REGIONAL_DATA'|'UNSTRUCTURED_REGIONAL_EVIDENCE';
 dimensions:RegionalDimension[];quote:string;reason:string;verified:boolean;
}
export interface RegionalAssessment {
 issueId:string;issueTitle:string;administrativeLevel:AdministrativeLevel;
 status:'SUPPORTED'|'PARTIALLY_SUPPORTED'|'INSUFFICIENT'|'CONFLICTING';eligible:boolean;
 evidenceCoverage:Record<RegionalDimension,{status:'available'|'partial'|'missing';evidenceIds:string[]}>;
 coverageCount:number;coverageTotal:number;regionalMetrics:RegionalMetric[];derivedIndicators:DerivedIndicator[];
 directEvidenceIds:string[];supportingEvidenceIds:string[];conflictingEvidenceIds:string[];parentContextEvidenceIds:string[];nationalContextEvidenceIds:string[];
 links:RegionalEvidenceLink[];dataGaps:RegionalDataGap[];issueSignal:number|null;
 scoreDimensions:Record<string,{score:number|null;evidenceIds:string[];reason:string}>;
 scoreCalculation:{weightedSum:number;weightSum:number;representativeIds:string[];excludedIds:string[]};
 limitations:string[];
}
export interface RegionalEngineInput {facility:FacilityProfile;issue:ArchitecturalIssue;items:EvaluatedEvidenceItem[];mode:'demo'|'live';discoveredEvidenceIds?:string[];structuredMetrics?:RegionalMetric[]}
export interface RegionalEngineResult {
 requirements:RegionalEvidenceRequirement[];evidenceLinks:RegionalEvidenceLink[];profiles:RegionEvidenceProfile[];supportedRegions:RegionEvidenceProfile[];
 nationalContext:EvaluatedEvidenceItem[];parentContext:EvaluatedEvidenceItem[];items:EvaluatedEvidenceItem[];
 metrics:RegionalMetric[];comparisonGroups:{key:string;metricType:string;metricIds:string[];regionIds:string[]}[];
 unresolved:{evidenceId:string;reason:string}[];
}
