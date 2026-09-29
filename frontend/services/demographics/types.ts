import type {RegionalMetric} from '../regional/types';
import type {Sigungu} from '../geography/sigunguRegistry';
import type {Phenomenon} from '../issues/types';
export interface AgeRange {label:string;minAge:number;maxAge:number|null;definitionSource:string;configurable:true}
export interface TargetPopulationProfile {facilityId:string;populationGroups:string[];primaryGroup:string;ageRanges:AgeRange[];householdSignals:string[];rationale:string;definitionId:string}
export type DemographicMetricType='TOTAL_POPULATION'|'TARGET_POPULATION'|'TARGET_POPULATION_SHARE'|'TARGET_POPULATION_CHANGE'|'TARGET_POPULATION_CHANGE_RATE';
export interface MetricDerivation {formula:string;inputMetricIds:string[];sourceEvidenceIds:string[];startDate:string|null;endDate:string;sourceTables:string[]}
export interface DemographicMetric extends RegionalMetric {facilityType:string;metricType:DemographicMetricType;dataMode:'LIVE'|'DEMO'|'MISSING';targetDefinition:string;derivation?:MetricDerivation;periodStart?:string;periodEnd?:string}
export interface RelativePosition {metric:DemographicMetricType;rawValue:number;percentile:number;comparisonPopulation:number;referencePeriod:string;cohortId:string;method:string}
export interface DemographicRegion {region:Sigungu;metrics:DemographicMetric[];positions:RelativePosition[];phenomena:Phenomenon[];gaps:string[];status:'COMPLETE'|'PARTIAL'|'NO_DATA'|'INCOMPARABLE'}
export interface DemographicResult {regions:DemographicRegion[];rawMetrics:DemographicMetric[];coverage:{total:number;complete:number;partial:number;missing:number;incomparable:number;unresolvedRows:number};cohorts:{id:string;metric:string;count:number;period:string}[]}
