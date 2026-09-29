import type { RegionalMetric } from '../regional/types';
import type { RegionReference } from '../geography/types';
export interface StructuredMetricSource {
 provider:string; mode:'live'|'demo'; tableId:string; tableName:string; organizationId:string;
 retrievedAt:string; providerRegionCode:string|null; itemId:string; periodType:string;
 normalizationStatus:'MATCHED'|'NATIONAL'|'AMBIGUOUS'|'UNKNOWN'; region:RegionReference;
 rawSource:Record<string,unknown>;
}
export interface RegionalDataRequest { target?:import("../demographics/types").TargetPopulationProfile;windowYears?:number; table?:string; periodType?:'M'|'Y'; periods?:string[]; latestCount?:number }
export interface RegionalDataResult {
 provider:string; metrics:RegionalMetric[]; metadata:Record<string,unknown>; retrievedAt:string;
 warnings:string[]; agePopulationStatus:'NOT_CONFIGURED';
}
export interface RegionalDataProvider {
 readonly id:string; readonly configured:boolean;
 getPopulation(request?:RegionalDataRequest):Promise<RegionalDataResult>;
 getPopulationByAge(request?:RegionalDataRequest):Promise<{status:'NOT_CONFIGURED'}|import('../../../backend/dataProviders/kosis/agePopulation').AgePopulationResult>;
 getRegionalMetrics(request?:RegionalDataRequest):Promise<RegionalDataResult>;
 getMetadata(table?:string):Promise<Record<string,unknown>>;
}
