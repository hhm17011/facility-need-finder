import type {FacilityProfile} from '../../evidenceTypes';
import type {RegionalMetric} from '../regional/types';
import type {Phenomenon} from '../issues/types';
export interface PopulationRequirement {targetPopulationType:string;ageRange:[number,number]|null;reason:string}
export type PopulationConfiguration=Record<string,{targetPopulationType:string;ageRange:[number,number]|null}>;
/** Age bands require explicit project configuration, not guessed legal/service eligibility. */
export function populationRequirement(profile:FacilityProfile,config:PopulationConfiguration={}):PopulationRequirement {
 const configured=config[profile.facilityName];
 return configured?{...configured,reason:'시설별 프로젝트 설정에 따른 대상 인구입니다.'}:{targetPopulationType:profile.primaryUsers.join(' / ')||'UNSPECIFIED',ageRange:null,reason:'대상 연령 범위를 확정하지 않았습니다. 총인구를 시설 이용 대상 인구로 대체하지 않습니다.'};
}
export interface PopulationTimeSeries {regionId:string;metric:string;points:{date:string;value:number;metricId:string}[];change:null|{absolute:number;percentage:number;startDate:string;endDate:string;sourceTable:string;sourceMetrics:string[];formula:string}}
export function populationTimeSeries(metrics:RegionalMetric[]):PopulationTimeSeries[]{
 const groups=new Map<string,RegionalMetric[]>();
 for(const m of metrics){
  if(m.structuredSource?.mode!=='live'||m.metricType!=='TOTAL_POPULATION'||m.verification!=='source_verified'||!m.regionId||m.value===null||!Number.isFinite(m.value)||!m.referenceDate)continue;
  const key=JSON.stringify([m.regionId,m.metricType,m.structuredSource.provider,m.structuredSource.tableId,m.structuredSource.itemId,m.structuredSource.periodType,m.structuredSource.providerRegionCode,m.unit,m.definition,m.populationDefinition,m.denominator,m.boundaryVersion,m.administrativeLevel,m.administrativeUnit]);
  groups.set(key,[...(groups.get(key)??[]),m]);
 }
 return [...groups.values()].map(rows=>{
  const ordered=[...rows].sort((a,b)=>a.referenceDate!.localeCompare(b.referenceDate!));
  const dates=[...new Set(ordered.map(m=>m.referenceDate!))];
  const conflicting=dates.some(date=>new Set(ordered.filter(m=>m.referenceDate===date).map(m=>m.value)).size>1);
  const unique=dates.map(date=>ordered.find(m=>m.referenceDate===date)!);
  const start=unique[0],end=unique.at(-1)!;
  const valid=unique.every(m=>m.boundaryVersion&&m.definition&&m.populationDefinition&&m.unit==='명'&&m.value!>=0&&!m.limitations.length);
  const change=valid&&!conflicting&&unique.length>1&&start.value!>0?{absolute:end.value!-start.value!,percentage:(end.value!-start.value!)/start.value!*100,startDate:start.referenceDate!,endDate:end.referenceDate!,sourceTable:start.structuredSource!.tableId,sourceMetrics:[start.metricId,end.metricId],formula:'(value_latest - value_previous) / value_previous * 100'}:null;
  return {regionId:start.regionId!,metric:start.metricType,points:ordered.map(m=>({date:m.referenceDate!,value:m.value!,metricId:m.metricId})),change};
 });
}
export function populationPhenomena(metrics:RegionalMetric[],profile:FacilityProfile):Phenomenon[]{
 return populationTimeSeries(metrics).flatMap(series=>{
  const change=series.change;if(!change)return [];
  const source=metrics.find(m=>m.metricId===change.sourceMetrics[1])!;
  return [{id:`population-change:${source.metricId}`,title:`${source.regionName} 총인구 ${change.absolute>0?'증가':change.absolute<0?'감소':'유지'}`,category:'DEMOGRAPHIC',description:`${change.startDate} → ${change.endDate}: ${change.absolute}명 (${change.percentage.toFixed(2)}%). 시설 공급 데이터 필요.`,direction:change.absolute>0?'INCREASE':change.absolute<0?'DECREASE':'STABLE',keywords:['총인구'],relatedFacility:profile.facilityName,affectedUsers:[],evidenceIds:metrics.filter(m=>change.sourceMetrics.includes(m.metricId)).map(m=>m.sourceEvidenceId),regions:[source.structuredSource!.region],confidence:null,scope:source.administrativeLevel==='NATIONAL'?'NATIONAL':'REGIONAL',passages:metrics.filter(m=>change.sourceMetrics.includes(m.metricId)).map(m=>({evidenceId:m.sourceEvidenceId,field:m.sourceLocator??'통계표',quote:m.sourceExcerpt})),status:'extracted'}];
 });
}
