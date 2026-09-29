import type { RegionalDimension } from './types';
export const regionalConfig={
 maxBroadQueries:6,maxValidationRegions:2,maxQueriesPerRegion:3,resultsPerQuery:5,
 minimumRelevance:60,minimumCompleteness:0.6,strongEvidence:75,
 supportedSources:2,supportedDimensions:2,highSources:4,highCoverage:0.8,mediumCoverage:0.5,
 sourceTarget:3,weights:{strength:1,coverage:1,relationship:1,comparability:1,sourceDiversity:1,completeness:1},
} as const;
export const dimensionLabels:Record<RegionalDimension,string>={DEMOGRAPHIC_CHANGE:'인구 변화',URBAN_CHANGE:'도시 변화',FACILITY_CHANGE:'시설 변화',DEMAND_SUPPLY:'수요·공급',SPATIAL_CONDITION:'공간적 조건',DIRECT_LOCAL:'지역 직접 조사'};
export const issueTypes=['SUPPLY_DEMAND_MISMATCH','SPATIAL_MISMATCH','ACCESSIBILITY_GAP','DEMOGRAPHIC_TRANSITION','URBAN_GROWTH_LAG','FACILITY_DECLINE','PROGRAM_MISMATCH','LIFECYCLE_MISMATCH','ADAPTIVE_REUSE_OPPORTUNITY','SERVICE_GAP','OTHER'] as const;
