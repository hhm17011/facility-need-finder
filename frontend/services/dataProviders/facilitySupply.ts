import type {FacilityProfile} from '../../evidenceTypes';
import type {DemographicMetric} from '../demographics/types';
import {percentile} from '../demographics/engine';
import {matchSigungu} from '../geography/sigunguRegistry';
export interface FacilitySupplyRequirement {facilityType:string;facilityCategory:string;preferredMetrics:string[];requiredAdministrativeLevel:'SIGUNGU';preferredSourceTypes:string[];populationDenominator:string;temporalRequirement:string;status:'CONFIGURED'|'MISSING'}
export function facilitySupplyRequirement(p:FacilityProfile):FacilitySupplyRequirement{return {facilityType:p.facilityName,facilityCategory:p.facilityCategory,preferredMetrics:p.facilityName==='어린이집'?['FACILITY_COUNT','TOTAL_CAPACITY','CURRENT_USERS','UTILIZATION_RATE']:['FACILITY_COUNT'],requiredAdministrativeLevel:'SIGUNGU',preferredSourceTypes:['OFFICIAL_API','OFFICIAL_STATISTICS'],populationDenominator:'TARGET_POPULATION',temporalRequirement:'동일 기준일; 변화는 동일 시작·종료 시점',status:p.facilityName==='어린이집'?'CONFIGURED':'MISSING'};}
export interface FacilityRecord {providerFacilityId:string|null;facilityType:string;facilityName:string;status:'ACTIVE'|'CLOSED'|'SUSPENDED'|'UNKNOWN';address:string|null;sido:string|null;sigungu:string|null;regionCode:string|null;normalizationStatus:'MATCHED'|'UNRESOLVED';capacity:number|null;currentUsers:number|null;openedDate:string|null;closedDate:string|null;referenceDate:string|null;provider:string;sourceUrl:string;retrievedAt:string;dataMode:'LIVE'|'DEMO';rawSource:Record<string,string>}
export type SupplyMetricType='FACILITY_COUNT'|'TOTAL_CAPACITY'|'CURRENT_USERS'|'AVAILABLE_CAPACITY'|'UTILIZATION_RATE'|'OPENING_COUNT'|'CLOSURE_COUNT'|'FACILITY_COUNT_CHANGE';
export interface FacilitySupplyMetric {metricId:string;facilityType:string;regionCode:string;regionName:string;administrativeLevel:'SIGUNGU';metricType:SupplyMetricType;value:number|null;unit:string;referenceDate:string|null;provider:string;sourceUrl:string;sourceDataset:string;sourceRecordCount:number;filteredRecordCount:number;excludedRecordCount:number;retrievedAt:string;dataMode:'LIVE'|'DEMO'|'MISSING';sourceRecordIds:string[];definition:string;limitations:string[];formula?:string;inputMetricIds?:string[]}
export interface FacilityDataQuality {sourceRecordCount:number;filteredRecordCount:number;excludedRecordCount:number;missingCapacity:number;missingStatus:number;unresolvedRegion:number;duplicateRecords:number;conflictingDuplicates:number;missingReferenceDate:number;geographicCoverage:number;queriedRegions:string[];completeResponse:boolean;missingCapacityRate:number|null;missingCurrentUsersRate:number|null;referenceDateCoverage:number|null;activeStatusCoverage:number|null}
export interface FacilitySupplyResult {records:FacilityRecord[];metrics:FacilitySupplyMetric[];quality:FacilityDataQuality;warnings:string[];provider:string}
export interface FacilitySupplyProvider {readonly configured:boolean;getFacilities(regionCode:string):Promise<FacilityRecord[]>;getFacilitySupplyMetrics(regionCode:string):Promise<FacilitySupplyResult>;getAvailablePeriods():Promise<string[]>;getMetadata():Record<string,unknown>}
export interface DemandSupplyIndicator {id:string;type:string;regionCode:string;value:number;unit:string;formula:string;inputMetricIds:string[];referenceDate:string;sourceUrls:string[];sourceIds:string[];targetDefinition:string;facilityType:string;facilityDefinition:string;populationDefinition:string;administrativeLevel:'SIGUNGU';dataMode:'LIVE'}
export interface DemandSupplyRelationship {id:string;regionCode:string;type:'SUPPLY_DEMAND_DIVERGENCE'|'SUPPLY_GROWTH_WITH_DEMAND_GROWTH'|'SUPPLY_DECLINE_WITH_DEMAND_DECLINE'|'SUPPLY_DECLINE_WITH_STABLE_DEMAND'|'POSSIBLE_OVERSUPPLY'|'INSUFFICIENT_DATA';description:string;inputMetricIds:string[];startDate:string;endDate:string;sourceUrls:string[];dataMode:'LIVE'}
const metricLive=(m:FacilitySupplyMetric)=>m.dataMode==='LIVE'&&m.value!==null&&Number.isFinite(m.value)&&!m.limitations.length;
export function demandSupplyIndicators(demand:DemographicMetric|undefined,supply:FacilitySupplyMetric[]):DemandSupplyIndicator[]{
 if(!demand||demand.metricType!=='TARGET_POPULATION'||demand.dataMode!=='LIVE'||demand.structuredSource?.mode!=='live'||demand.verification!=='source_verified'||demand.administrativeLevel!=='SIGUNGU'||demand.value===null||!Number.isFinite(demand.value)||demand.value<0||!demand.targetDefinition||demand.unit!=='명'||!demand.referenceDate)return [];
 const compatible=supply.filter(m=>metricLive(m)&&m.administrativeLevel===demand.administrativeLevel&&m.regionCode===demand.regionCode&&m.facilityType===demand.facilityType&&m.referenceDate===demand.referenceDate);
 const out:DemandSupplyIndicator[]=[];
 for(const m of compatible.filter(m=>['FACILITY_COUNT','TOTAL_CAPACITY'].includes(m.metricType))){
  const count=m.metricType==='FACILITY_COUNT';if(m.unit!==(count?'개소':'명'))continue;
  const push=(type:string,value:number,formula:string,unit:string)=>out.push({id:`${type}:${demand.metricId}:${m.metricId}`,type,regionCode:m.regionCode,value,formula,unit,inputMetricIds:[demand.metricId,m.metricId],referenceDate:demand.referenceDate!,sourceUrls:[demand.sourceUrl!,m.sourceUrl],sourceIds:[demand.sourceEvidenceId,...m.sourceRecordIds.map(id=>`${m.provider}:${id}`)],targetDefinition:demand.targetDefinition,facilityType:m.facilityType,facilityDefinition:m.definition,populationDefinition:demand.populationDefinition??'',administrativeLevel:'SIGUNGU',dataMode:'LIVE'});
  if(demand.value>0)push(count?'FACILITIES_PER_1000_TARGET_POPULATION':'CAPACITY_PER_1000_TARGET_POPULATION',m.value!/demand.value*1000,count?'facilityCount / targetPopulation * 1000':'totalCapacity / targetPopulation * 1000',count?'개소/1,000명':'정원/1,000명');
  if(m.value!>0)push(count?'TARGET_POPULATION_PER_FACILITY':'TARGET_POPULATION_PER_CAPACITY',demand.value/m.value!,count?'targetPopulation / facilityCount':'targetPopulation / totalCapacity',count?'명/개소':'명/정원');
 }
 return out;
}
export function demandSupplyRelationship(d0:DemographicMetric,d1:DemographicMetric,s0:FacilitySupplyMetric,s1:FacilitySupplyMetric):DemandSupplyRelationship|null{
 if(!metricLive(s0)||!metricLive(s1)||s0.metricType!==s1.metricType||s0.facilityType!==s1.facilityType||s0.definition!==s1.definition||s0.unit!==s1.unit||!d0.boundaryVersion||d0.boundaryVersion!==d1.boundaryVersion||d0.targetDefinition!==d1.targetDefinition||!demandSupplyIndicators(d0,[s0]).length||!demandSupplyIndicators(d1,[s1]).length||s0.regionCode!==s1.regionCode||!s0.referenceDate||!s1.referenceDate||s0.referenceDate>=s1.referenceDate)return null;
 const d=d1.value!-d0.value!,s=s1.value!-s0.value!;
 const type=d>0&&s<0?'SUPPLY_DEMAND_DIVERGENCE':d>0&&s>0?'SUPPLY_GROWTH_WITH_DEMAND_GROWTH':d<0&&s<0?'SUPPLY_DECLINE_WITH_DEMAND_DECLINE':d===0&&s<0?'SUPPLY_DECLINE_WITH_STABLE_DEMAND':d<0&&s>=0?'POSSIBLE_OVERSUPPLY':'INSUFFICIENT_DATA';
 return {id:`relationship:${d0.metricId}:${d1.metricId}:${s0.metricId}:${s1.metricId}`,regionCode:s1.regionCode,type,description:`${s0.referenceDate}~${s1.referenceDate}: 대상 인구 ${d>0?'증가':d<0?'감소':'유지'}, 시설 공급 ${s>0?'증가':s<0?'감소':'유지'}. 공간 분포·이용 행태의 추가 조사 필요.`,inputMetricIds:[d0.metricId,d1.metricId,s0.metricId,s1.metricId],startDate:s0.referenceDate,endDate:s1.referenceDate,sourceUrls:[d0.sourceUrl!,d1.sourceUrl!,s0.sourceUrl,s1.sourceUrl],dataMode:'LIVE'};
}
export interface FacilityAggregationDefinition {facilityType:string;provider:string;dataset:string;sourceUrl:string;activeDefinition:string}
const childcareAggregation:FacilityAggregationDefinition={facilityType:'어린이집',provider:'CHILDCARE',dataset:'cpmsapi030',sourceUrl:'https://info.childcare.go.kr/info/oais/openapi/OpenApiInfoSl.jsp?flag=VIEW&svcseq=82',activeDefinition:'어린이집; crstatusname 정상 또는 재개; 폐지일 없음; 고유 stcode 중복 제거'};
export function aggregateFacilities(records:FacilityRecord[],queriedRegion:string,completeResponse=true,definition:FacilityAggregationDefinition=childcareAggregation):FacilitySupplyResult {
 const live=records.filter(r=>r.dataMode==='LIVE');const grouped=new Map<string,FacilityRecord[]>();let unknownId=0;
 for(const r of live){const key=r.providerFacilityId?`${r.provider}:${r.providerFacilityId}`:`unknown:${unknownId++}`;grouped.set(key,[...(grouped.get(key)??[]),r]);}
 let duplicates=0,conflicts=0;const unique:FacilityRecord[]=[];
 for(const group of grouped.values()){duplicates+=group.length-1;if(new Set(group.map(r=>JSON.stringify([r.facilityType,r.facilityName,r.address,r.regionCode,r.status,r.capacity,r.currentUsers,r.referenceDate]))).size>1){conflicts++;continue;}unique.push(group[0]);}
 const active=unique.filter(r=>r.status==='ACTIVE'&&r.regionCode===queriedRegion&&r.normalizationStatus==='MATCHED'&&r.facilityType===definition.facilityType&&r.provider===definition.provider&&r.providerFacilityId);
 const q:FacilityDataQuality={sourceRecordCount:live.length,filteredRecordCount:active.length,excludedRecordCount:live.length-active.length,missingCapacity:active.filter(r=>r.capacity===null).length,missingStatus:unique.filter(r=>r.status==='UNKNOWN').length,unresolvedRegion:unique.filter(r=>r.normalizationStatus==='UNRESOLVED'||r.regionCode!==queriedRegion).length,duplicateRecords:duplicates,conflictingDuplicates:conflicts,missingReferenceDate:active.filter(r=>!r.referenceDate).length,geographicCoverage:active.length?1:0,queriedRegions:[queriedRegion],completeResponse,missingCapacityRate:active.length?active.filter(r=>r.capacity===null).length/active.length:null,missingCurrentUsersRate:active.length?active.filter(r=>r.currentUsers===null).length/active.length:null,referenceDateCoverage:unique.length?unique.filter(r=>r.referenceDate!==null).length/unique.length:null,activeStatusCoverage:unique.length?unique.filter(r=>r.status!=='UNKNOWN').length/unique.length:null};
 const region=matchSigungu('',queriedRegion).region;const dates=[...new Set(active.map(r=>r.referenceDate))];const date=dates.length===1?dates[0]:null;
 const gaps=[...(!completeResponse?['응답 완전성 미확인']:[]),...(q.unresolvedRegion?['지역 매핑 실패 포함']:[]),...(q.missingStatus?['운영상태 미확인 포함']:[]),...(conflicts?['동일 시설의 상충 중복']:[]),...(!date?['공통 기준일 미확인']:[]),...(unknownId?['시설 고유번호 미확인']:[])];
 const metrics:FacilitySupplyMetric[]=[];
 const add=(type:SupplyMetricType,value:number|null,unit:string,extra:string[]=[])=>{const limitations=[...gaps,...extra];metrics.push({metricId:`${definition.provider}:${queriedRegion}:${date??'unknown'}:${type}`,facilityType:definition.facilityType,regionCode:queriedRegion,regionName:region?.fullName??queriedRegion,administrativeLevel:'SIGUNGU',metricType:type,value:limitations.length?null:value,unit,referenceDate:date,provider:definition.provider,sourceUrl:definition.sourceUrl,sourceDataset:definition.dataset,sourceRecordCount:live.length,filteredRecordCount:active.length,excludedRecordCount:q.excludedRecordCount,retrievedAt:live[0]?.retrievedAt??'',dataMode:value===null||limitations.length?'MISSING':'LIVE',sourceRecordIds:active.map(r=>r.providerFacilityId!),definition:definition.activeDefinition,limitations});};
 add('FACILITY_COUNT',active.length,'개소');add('TOTAL_CAPACITY',active.reduce((s,r)=>s+(r.capacity??0),0),'명',q.missingCapacity?['정원 누락: 합계를 대체하지 않음']:[]);
 const missingUsers=active.some(r=>r.currentUsers===null);add('CURRENT_USERS',active.reduce((s,r)=>s+(r.currentUsers??0),0),'명',missingUsers?['현원 누락']:[]);
 const capacity=metrics.find(m=>m.metricType==='TOTAL_CAPACITY')!,users=metrics.find(m=>m.metricType==='CURRENT_USERS')!;
 const compatible=capacity.dataMode==='LIVE'&&users.dataMode==='LIVE'&&users.value!<=capacity.value!;
 add('AVAILABLE_CAPACITY',compatible?capacity.value!-users.value!:null,'명',compatible?[]:['정원·현원 미확인 또는 현원 초과']);
 add('UTILIZATION_RATE',compatible&&capacity.value!>0?users.value!/capacity.value!*100:null,'%',compatible&&capacity.value!>0?[]:['정원·현원 또는 0 분모 확인 필요']);
 for(const m of metrics.filter(m=>['AVAILABLE_CAPACITY','UTILIZATION_RATE'].includes(m.metricType))){m.formula=m.metricType==='AVAILABLE_CAPACITY'?'totalCapacity - currentUsers':'currentUsers / totalCapacity * 100';m.inputMetricIds=[capacity.metricId,users.metricId];}
 return {records:live,metrics,quality:q,provider:definition.provider,warnings:[...gaps,'시설 공급 변화 데이터 미연결','현원/정원은 시설 공급 지표이며 시설 부족의 판정 기준이 아닙니다.']};
}

export interface SupplyRelativePosition {indicatorId:string;type:string;regionCode:string;rawValue:number;percentile:number;cohortSize:number;referencePeriod:string;cohortId:string}
/** Compare only identical indicator, population/facility definitions, unit and reference period. */
export function supplyIndicatorPositions(indicators:DemandSupplyIndicator[]):SupplyRelativePosition[]{
 const groups=new Map<string,DemandSupplyIndicator[]>();
 for(const i of indicators){if(i.dataMode!=='LIVE'||!Number.isFinite(i.value)||i.administrativeLevel!=='SIGUNGU'||!i.targetDefinition||!i.facilityDefinition||!matchSigungu('',i.regionCode).region?.analysisUnit)continue;
 const key=JSON.stringify([i.type,i.unit,i.targetDefinition,i.populationDefinition,i.facilityType,i.facilityDefinition,i.administrativeLevel,i.referenceDate]);groups.set(key,[...(groups.get(key)??[]),i]);}
 return [...groups].flatMap(([cohortId,rows])=>rows.length<2||new Set(rows.map(r=>r.regionCode)).size!==rows.length?[]:rows.map(r=>({indicatorId:r.id,type:r.type,regionCode:r.regionCode,rawValue:r.value,percentile:percentile(r.value,rows.map(v=>v.value))!,cohortSize:rows.length,referencePeriod:r.referenceDate,cohortId})));
}
export function demandSupplyCompatibility(demand:DemographicMetric|undefined,supply:FacilitySupplyMetric[]):{status:'COMPATIBLE'|'INCOMPATIBLE'|'UNKNOWN';reasons:string[]}{
 if(!demand||!supply.length)return {status:'UNKNOWN',reasons:['수요 또는 공급 입력 없음']};
 const relevant=supply.filter(m=>['FACILITY_COUNT','TOTAL_CAPACITY'].includes(m.metricType));const reasons:string[]=[];
 if(!demand.referenceDate||relevant.some(m=>!m.referenceDate))reasons.push('기준일 미확인');
 if(relevant.some(m=>m.referenceDate!==demand.referenceDate))reasons.push('수요·공급 기준일 불일치: 월/일 자료를 임의 정렬하지 않음');
 if(relevant.some(m=>m.regionCode!==demand.regionCode||m.administrativeLevel!==demand.administrativeLevel))reasons.push('행정구역 불일치');
 if(relevant.some(m=>m.facilityType!==demand.facilityType)||!demand.targetDefinition)reasons.push('시설 또는 대상인구 정의 불일치');
 if(!demandSupplyIndicators(demand,relevant).length)reasons.push('검증된 LIVE 입력·단위·양수 분모 필요 (0/null은 N/A)');
 return {status:reasons.length?'INCOMPATIBLE':'COMPATIBLE',reasons};
}
