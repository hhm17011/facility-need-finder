import {analysisSigungu,sigunguReference,type Sigungu} from '../geography/sigunguRegistry';
import type {DemographicMetric,DemographicMetricType,DemographicRegion,DemographicResult,RelativePosition,TargetPopulationProfile} from './types';
const valid=(m:DemographicMetric)=>m.dataMode==='LIVE'&&m.structuredSource?.mode==='live'&&m.verification==='source_verified'&&m.administrativeLevel==='SIGUNGU'&&m.value!==null&&Number.isFinite(m.value)&&!!m.referenceDate;
function compatible(a:DemographicMetric,b:DemographicMetric,time=false){return valid(a)&&valid(b)&&a.regionCode===b.regionCode&&a.administrativeUnit===b.administrativeUnit&&a.unit===b.unit&&a.populationDefinition===b.populationDefinition&&a.structuredSource!.tableId===b.structuredSource!.tableId&&(time?!!a.boundaryVersion&&a.boundaryVersion===b.boundaryVersion:a.referenceDate===b.referenceDate);}
function derived(base:DemographicMetric,type:DemographicMetricType,value:number,unit:string,formula:string,inputs:DemographicMetric[]):DemographicMetric{return {...base,metricId:`${type}:${inputs.map(m=>m.metricId).join('|')}`,metricType:type,value,unit,periodStart:inputs[0].referenceDate!,periodEnd:inputs.at(-1)!.referenceDate!,derivation:{formula,inputMetricIds:inputs.map(m=>m.metricId),sourceEvidenceIds:[...new Set(inputs.flatMap(m=>m.derivation?.sourceEvidenceIds??[m.sourceEvidenceId]))],startDate:inputs[0].referenceDate,endDate:inputs.at(-1)!.referenceDate!,sourceTables:[...new Set(inputs.map(m=>m.structuredSource!.tableId))]}};}
/** Midrank percentile. Ties have equal position; one region cannot define a distribution. */
export function percentile(value:number,values:number[]):number|null {if(values.length<2||!values.every(Number.isFinite)||!Number.isFinite(value))return null;return (values.filter(v=>v<value).length+values.filter(v=>v===value).length/2)/values.length*100;}
export function demographicEngine(input:DemographicMetric[],target:TargetPopulationProfile,mode:'demo'|'live',registry:Sigungu[]=analysisSigungu):DemographicResult {
 const rawMetrics=mode==='live'?input.filter(m=>m.dataMode!=='DEMO'&&m.structuredSource?.mode==='live'&&m.targetDefinition===target.definitionId):[];
 const regions:DemographicRegion[]=registry.map(region=>{
  const source=rawMetrics.filter(m=>m.regionCode===region.regionCode);const latest=[...new Set(source.map(m=>m.referenceDate).filter(Boolean))].sort().at(-1);
  const unique=(type:string,date:string|null|undefined)=>{const rows=source.filter(m=>m.metricType===type&&m.referenceDate===date);return rows.length===1&&valid(rows[0])?rows[0]:undefined;};
  const total=unique('TOTAL_POPULATION',latest),population=unique('TARGET_POPULATION',latest);
  const metrics:DemographicMetric[]=[...source.filter(m=>m.referenceDate===latest)];const gaps:string[]=[];
  if(!total)gaps.push('총인구 없음 또는 중복·상충');if(!population)gaps.push('대상 연령 인구 없음 또는 중복·상충');
  if(population&&total&&compatible(population,total)&&total.value!>0&&population.value!<=total.value!)metrics.push(derived(population,'TARGET_POPULATION_SHARE',population.value!/total.value!,'비율','targetPopulation / totalPopulation',[total,population]));
  else gaps.push('비율 입력의 시점·정의·단위 또는 분모 확인 필요');
  const previousDates=[...new Set(source.filter(m=>m.referenceDate&&m.referenceDate!==latest).map(m=>m.referenceDate!))].sort();
  const previous=unique('TARGET_POPULATION',previousDates[0]);
  if(population&&previous&&compatible(population,previous,true)&&population.targetDefinition===previous.targetDefinition){
   metrics.push(derived(population,'TARGET_POPULATION_CHANGE',population.value!-previous.value!,'명','latestTargetPopulation - previousTargetPopulation',[previous,population]));
   if(previous.value!>0)metrics.push(derived(population,'TARGET_POPULATION_CHANGE_RATE',(population.value!-previous.value!)/previous.value!*100,'%','(latest - previous) / previous * 100',[previous,population]));else gaps.push('변화율 분모가 0입니다.');
  }else gaps.push('비교 가능한 과거 시점·동일 행정경계 확인 필요');
  const has=metrics.some(valid);return {region,metrics,positions:[],phenomena:[],gaps,status:!has?'NO_DATA':!population||!total?'PARTIAL':gaps.length?'INCOMPARABLE':'COMPLETE'};
 });
 const groups=new Map<string,{row:DemographicRegion;metric:DemographicMetric}[]>();
 for(const row of regions)for(const metric of row.metrics.filter(valid)){
  const key=JSON.stringify([metric.metricType,metric.targetDefinition,metric.referenceDate,metric.periodStart,metric.periodEnd,metric.unit,metric.populationDefinition,metric.administrativeUnit,metric.structuredSource!.tableId]);
  groups.set(key,[...(groups.get(key)??[]),{row,metric}]);
 }
 const cohorts:DemographicResult['cohorts']=[];
 for(const [id,entries] of groups){
  if(entries.length<2||new Set(entries.map(e=>e.row.region.regionCode)).size!==entries.length)continue;
  const values=entries.map(e=>e.metric.value!);cohorts.push({id,metric:entries[0].metric.metricType,count:entries.length,period:entries[0].metric.referenceDate!});
  for(const {row,metric} of entries){const p:RelativePosition={metric:metric.metricType,rawValue:metric.value!,percentile:percentile(metric.value!,values)!,comparisonPopulation:values.length,referencePeriod:metric.referenceDate!,cohortId:id,method:'100 * (count(lower) + 0.5 * count(equal)) / count(valid)'};row.positions.push(p);}
 }
 for(const row of regions){
  const change=row.metrics.find(m=>m.metricType==='TARGET_POPULATION_CHANGE');
  if(change&&valid(change))row.phenomena.push({id:`demographic:${change.metricId}`,title:change.value!>0?'TARGET_POPULATION_GROWTH':change.value!<0?'TARGET_POPULATION_DECLINE':'STABLE_TARGET_POPULATION',category:'DEMOGRAPHIC',description:`${row.region.fullName}: ${change.periodStart}~${change.periodEnd} 대상 인구 ${change.value}명 변화. 시설 공급 데이터와 추가 비교 필요.`,direction:change.value!>0?'INCREASE':change.value!<0?'DECREASE':'STABLE',keywords:target.populationGroups,relatedFacility:target.facilityId,affectedUsers:target.populationGroups,evidenceIds:change.derivation!.sourceEvidenceIds,regions:[sigunguReference(row.region)],confidence:null,scope:'REGIONAL',passages:[{evidenceId:change.sourceEvidenceId,field:change.sourceLocator??'',quote:change.sourceExcerpt}],status:'extracted'});
 }
 return {regions,rawMetrics,cohorts,coverage:{total:registry.length,complete:regions.filter(r=>r.status==='COMPLETE').length,partial:regions.filter(r=>r.status==='PARTIAL').length,missing:regions.filter(r=>r.status==='NO_DATA').length,incomparable:regions.filter(r=>r.status==='INCOMPARABLE').length,unresolvedRows:rawMetrics.filter(m=>!m.regionCode&&m.administrativeLevel==='UNKNOWN').length}};
}
