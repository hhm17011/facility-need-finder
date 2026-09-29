import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { normalizeRegion,referencesInText } from '../geography/regionNormalizer';
import { administrativeLevel } from './administrative';
import type { DerivedIndicator, RegionalMetric, RegionalObservation } from './types';
export function extractRegionalMetrics(items:EvaluatedEvidenceItem[]):RegionalMetric[]{
 return items.flatMap(item=>{
 const legacy:RegionalObservation[]=item.quantitativeEvidence.map((value,index)=>({metricId:`legacy-${index}`,metricType:value.indicator,dimension:'UNKNOWN',regionName:value.geographicScope,administrativeLevel:administrativeLevel(value.geographicScope),value:value.value,unit:value.unit,referenceDate:value.referencePeriod,definition:null,populationDefinition:null,denominator:null,boundaryVersion:null,sourceExcerpt:value.sourceExcerpt,sourceLocator:value.sourceLocator,verification:'unverified'}));
 return [...(item.regionalObservations??[]),...legacy].map(observation=>{
  const region=normalizeRegion(observation.regionName);const limitations:string[]=[];
  const quoteRegions=referencesInText(observation.sourceExcerpt);
  if(observation.verification!=='source_verified')limitations.push('원문 수치 검증이 필요합니다.');
  if(region.normalizationStatus!=='matched'||!quoteRegions.some(r=>r.id===region.id))limitations.push('지표 원문에 명시된 정규 지역을 확인하지 못했습니다.');
  if(administrativeLevel(observation.regionName,region)!==observation.administrativeLevel||administrativeLevel(observation.sourceExcerpt,region)==='EUPMYEONDONG'&&observation.administrativeLevel!=='EUPMYEONDONG')limitations.push('지표와 원문의 행정 단위가 일치하지 않습니다.');
  if(observation.value===null||!Number.isFinite(observation.value))limitations.push('값이 없습니다.');
  else if(!(observation.sourceExcerpt.replaceAll(',','').match(/-?\d+(?:\.\d+)?/g)??[]).some(token=>Number(token)===observation.value))limitations.push('수치가 원문 발췌에 없습니다.');
  for(const field of ['unit','referenceDate','definition','populationDefinition','denominator','boundaryVersion'] as const)if(!observation[field]?.trim())limitations.push(`${field} 미확인`);
  if(observation.referenceDate){const period=observation.referenceDate;const iso=period.length===4?`${period}-01-01`:period.length===7?`${period}-01`:period;const parsed=new Date(iso);if(!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(period)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)limitations.push('기준 시점 형식 미확인');}
  const administrativeUnit=region.level3?'DISTRICT':region.level2?.endsWith('구')?'DISTRICT':region.level2?'CITY_COUNTY':observation.administrativeLevel;
  return {...observation,metricId:`${item.id}::${observation.metricId}`,regionCode:region.regionCode,regionId:region.id,sourceEvidenceId:item.id,sourceUrl:item.url,administrativeUnit,comparisonGroup:null,comparable:false,limitations};
 });});
}
const groupKey=(m:RegionalMetric)=>JSON.stringify([m.metricType,m.administrativeLevel,m.administrativeUnit,m.referenceDate,m.unit,m.definition,m.populationDefinition,m.denominator,m.boundaryVersion]);
export function compareRegionalMetrics(input:RegionalMetric[]){
 const metrics=structuredClone(input);const eligible=metrics.filter(m=>!m.limitations.length);
 const keys=[...new Set(eligible.map(groupKey))];
 const comparisonGroups: {key:string;metricType:string;metricIds:string[];regionIds:string[]}[]=[];
 for(const key of keys){
  const rows=eligible.filter(m=>groupKey(m)===key);
  const conflicting=new Set(rows.filter(m=>rows.some(other=>other.regionId===m.regionId&&other.value!==m.value)).map(m=>m.regionId));
  for(const row of rows.filter(m=>conflicting.has(m.regionId)))row.limitations.push('동일 지역·정의·시점의 수치가 상충합니다.');
  const compatible=rows.filter(m=>!conflicting.has(m.regionId));const regions=[...new Set(compatible.map(m=>m.regionId!))];
  if(regions.length>=2){for(const row of compatible){row.comparable=true;row.comparisonGroup=key;}comparisonGroups.push({key,metricType:compatible[0].metricType,metricIds:compatible.map(m=>m.metricId),regionIds:regions});}
 }
 for(const metric of metrics){
  const peers=metrics.filter(m=>m.regionId!==metric.regionId&&m.metricType===metric.metricType);
  if(peers.some(m=>m.referenceDate!==metric.referenceDate))metric.limitations.push('비교 자료의 기준연도가 다릅니다. 다른 시점은 별도 그룹으로 분리합니다.');
  if(!metric.comparable)metric.limitations.push('동일 지표·행정 단위·시점·단위·정의·모집단·분모·경계 기준의 비교 지역이 없습니다.');
 }
 return {metrics,comparisonGroups};
}
/** No conversions or imputation. Require exact same-region/same-period/cohort boundaries. */
export function deriveFacilityPerThousand(population:RegionalMetric,facilityCount:RegionalMetric):DerivedIndicator|null{
 if(population.metricType!=='target_population'||facilityCount.metricType!=='facility_count'||population.unit!=='명'||facilityCount.unit!=='개소')return null;
 if(population.value===null||facilityCount.value===null||!Number.isFinite(population.value)||!Number.isFinite(facilityCount.value)||population.value<=0||facilityCount.value<0)return null;
 if(population.verification!=='source_verified'||facilityCount.verification!=='source_verified')return null;
 for(const key of ['regionId','administrativeLevel','administrativeUnit','referenceDate','populationDefinition','denominator','boundaryVersion'] as const)if(!population[key]||population[key]!==facilityCount[key])return null;
 if(!population.definition||!facilityCount.definition)return null;
 // Original validation failures prohibit derivation; comparison group absence is not an input error.
 const validLimit=(l:string)=>l.startsWith('동일 지표·')||l.startsWith('비교 자료의 기준연도');
 if([...population.limitations,...facilityCount.limitations].some(l=>!validLimit(l)))return null;
 return {indicator:'대상인구 1,000명당 시설 수',formula:'facility_count / target_population * 1000',inputs:[facilityCount.metricId,population.metricId],result:facilityCount.value/population.value*1000,sourceEvidenceIds:[...new Set([population.sourceEvidenceId,facilityCount.sourceEvidenceId])],referenceYears:[population.referenceDate!,facilityCount.referenceDate!]};
}
