import type { FacilityProfile, EvidenceType } from '../../evidenceTypes';
import type { ArchitecturalIssue, IssueType } from '../issues/types';
import type { SearchQuery } from '../evidence/types';
import { preferredDomains } from '../evidence/queryBuilder';
import { regionalConfig } from './config';
import type { RegionalDimension, RegionalEvidenceRequirement } from './types';
import type { RegionReference } from '../geography/types';
const metricSets:Record<RegionalDimension,string[]>={DEMOGRAPHIC_CHANGE:['target_population','population_change_rate','migration'],URBAN_CHANGE:['housing_development','residential_growth'],FACILITY_CHANGE:['facility_count','facility_capacity','closure_count','utilization_rate'],DEMAND_SUPPLY:['capacity_per_population','waiting_demand','occupancy_rate'],SPATIAL_CONDITION:['travel_distance','service_coverage','facility_distribution'],DIRECT_LOCAL:['local_survey','user_behavior','program_preference']};
const required:Record<IssueType,RegionalDimension[]>={SUPPLY_DEMAND_MISMATCH:['DEMOGRAPHIC_CHANGE','FACILITY_CHANGE','DEMAND_SUPPLY'],SPATIAL_MISMATCH:['DEMOGRAPHIC_CHANGE','FACILITY_CHANGE','SPATIAL_CONDITION'],ACCESSIBILITY_GAP:['SPATIAL_CONDITION','DIRECT_LOCAL'],DEMOGRAPHIC_TRANSITION:['DEMOGRAPHIC_CHANGE','FACILITY_CHANGE'],URBAN_GROWTH_LAG:['URBAN_CHANGE','FACILITY_CHANGE','SPATIAL_CONDITION'],FACILITY_DECLINE:['FACILITY_CHANGE','DEMOGRAPHIC_CHANGE'],PROGRAM_MISMATCH:['DIRECT_LOCAL','FACILITY_CHANGE'],LIFECYCLE_MISMATCH:['FACILITY_CHANGE','DEMOGRAPHIC_CHANGE'],ADAPTIVE_REUSE_OPPORTUNITY:['FACILITY_CHANGE','SPATIAL_CONDITION','DIRECT_LOCAL'],SERVICE_GAP:['DEMAND_SUPPLY','SPATIAL_CONDITION','DIRECT_LOCAL'],OTHER:['SPATIAL_CONDITION','DIRECT_LOCAL']};
export function regionalRequirements(facility:FacilityProfile,issue:Pick<ArchitecturalIssue,'id'|'issueType'>):RegionalEvidenceRequirement[]{
 const users=facility.primaryUsers.join('·')||'이용 대상'; const name=facility.facilityName;
 const questions:Record<RegionalDimension,string>={DEMOGRAPHIC_CHANGE:`${users}의 인구·이동은 어느 시·군·구에서 변화하는가?`,URBAN_CHANGE:`개발과 생활권 변화가 ${name}의 지역 맥락과 어떻게 연결되는가?`,FACILITY_CHANGE:`${name}의 분포·정원·이용·신설·폐쇄 현황은 어떠한가?`,DEMAND_SUPPLY:`${users}와 ${name}의 공급·이용은 같은 기준으로 비교 가능한가?`,SPATIAL_CONDITION:`${name}의 접근 거리·분포·생활권은 지역 자료로 확인되는가?`,DIRECT_LOCAL:`지역 이용자의 활동·이용·미이용 이유가 직접 조사되었는가?`};
 return (Object.keys(metricSets) as RegionalDimension[]).map(dimension=>({id:`${issue.id}:${dimension}`,issueId:issue.id,dimension,question:questions[dimension],requiredMetrics:metricSets[dimension],preferredAdministrativeLevel:'SIGUNGU',acceptableAdministrativeLevels:['SIGUNGU','SIDO'],preferredSourceTypes:dimension==='DIRECT_LOCAL'?['DEMAND_SURVEY','SURVEY']:dimension==='SPATIAL_CONDITION'?['RESEARCH','PUBLIC_REPORT']:['STATISTICS','PUBLIC_REPORT'],importance:required[issue.issueType].includes(dimension)?'required':'supporting'}));
}
export function regionalQueries(facility:FacilityProfile,issueType:IssueType,stage:'discovery'|'validation',region?:RegionReference):SearchQuery[]{
 const requirements=regionalRequirements(facility,{id:'regional',issueType}).sort((a,b)=>Number(b.importance==='required')-Number(a.importance==='required'));
 const users=facility.primaryUsers.join(' ')||'이용자';const facilityName=facility.facilityName;
 const terms:Record<RegionalDimension,string>={DEMOGRAPHIC_CHANGE:`${users} 인구 변화 증가 감소 이동 지역별 통계`,URBAN_CHANGE:'주거 개발 생활권 인구 유입 유출 공공 보고서',FACILITY_CHANGE:`${facilityName} 공급 현황 정원 이용률 폐쇄 신규 설치`,DEMAND_SUPPLY:`${facilityName} 정원 충족률 공급 충분 과잉 수요 변화`,SPATIAL_CONDITION:`${facilityName} 접근성 시설 분포 지역 연구`,DIRECT_LOCAL:`${facilityName} 이용 미이용 활동 요구 지자체 조사`};
 return requirements.slice(0,stage==='discovery'?regionalConfig.maxBroadQueries:regionalConfig.maxQueriesPerRegion).map(requirement=>{
  const category=requirement.preferredSourceTypes[0] as EvidenceType;
  return {category,query:`${stage==='validation'?region!.displayName:'시군구'} ${facilityName} ${terms[requirement.dimension]}`,purpose:requirement.question,priority:'normal',geographicScope:region?.displayName??'대한민국 시·군·구 발견',preferredSourceTypes:category==='STATISTICS'?['official_statistics']:category==='DEMAND_SURVEY'?['demand_survey']:['public_institution_report'],preferredDomains:preferredDomains[category],maxResults:regionalConfig.resultsPerQuery};
 });
}
