import type {DemographicResult} from './types';
import {scoreRegion} from '../geography/candidateScore';
import {sigunguReference} from '../geography/sigunguRegistry';
import {demandSupplyIndicators,demandSupplyRelationship,supplyIndicatorPositions,demandSupplyCompatibility,type FacilitySupplyResult} from '../dataProviders/facilitySupply';
import type {RegionEvidenceProfile} from '../geography/types';
import type {ArchitecturalIssue} from '../issues/types';
/** Population/supply metrics are not evidence strength scores. A selected matching relationship is required. */
export function buildStructuredProfiles(demographics:DemographicResult,supply:FacilitySupplyResult[],mode:'demo'|'live',issue?:ArchitecturalIssue):RegionEvidenceProfile[]{
 const profiles:RegionEvidenceProfile[]=demographics.regions.map(row=>{
  const base=scoreRegion(sigunguReference(row.region),[],[],mode);
  const metrics=mode==='live'?supply.flatMap(s=>s.metrics).filter(m=>m.regionCode===row.region.regionCode&&m.dataMode!=='DEMO'):[];
  const demand=row.metrics.find(m=>m.metricType==='TARGET_POPULATION');const indicators=mode==='live'?demandSupplyIndicators(demand,metrics):[];
  const history=demographics.rawMetrics.filter(m=>m.regionCode===row.region.regionCode&&m.metricType==='TARGET_POPULATION').sort((a,b)=>(a.referenceDate??'').localeCompare(b.referenceDate??''));
  const relationships=[];
  if(mode==='live'&&history.length>=2){const first=history[0],last=history.at(-1)!;for(const kind of ['FACILITY_COUNT','TOTAL_CAPACITY']){const start=metrics.find(m=>m.metricType===kind&&m.referenceDate===first.referenceDate),end=metrics.find(m=>m.metricType===kind&&m.referenceDate===last.referenceDate);if(start&&end){const relation=demandSupplyRelationship(first,last,start,end);if(relation)relationships.push(relation);}}}
  const hasDemand=!!demand&&demand.dataMode==='LIVE'&&demand.value!==null;
  const hasSupply=metrics.some(m=>m.dataMode==='LIVE'&&m.value!==null);
  const conflicting=new Set(relationships.map(r=>r.type)).size>1;
  const relevant=issue?.mode==='live'&&['SUPPLY_DEMAND_MISMATCH','DEMOGRAPHIC_TRANSITION','FACILITY_DECLINE','ADAPTIVE_REUSE_OPPORTUNITY'].includes(issue.issueType)?relationships.filter(r=>issue.relationshipIds.includes(r.id)):[];
  return {...base,rank:null,candidateScore:null,confidence:relevant.length?'LOW':'INSUFFICIENT',demographicMetrics:row.metrics,demographicPositions:row.positions,demographicPhenomena:row.phenomena,facilitySupplyMetrics:metrics,demandSupplyIndicators:indicators,demandSupplyRelationships:relationships,facilityDataQuality:mode==='live'?supply.filter(s=>s.quality.queriedRegions.includes(row.region.regionCode)).map(s=>s.quality):[],demandSupplyCompatibility:demandSupplyCompatibility(demand,metrics),facilityDataCoverage:{available:metrics.filter(m=>m.dataMode==='LIVE').length,requested:8,status:conflicting?'CONFLICTING':relationships.some(r=>r.type!=='INSUFFICIENT_DATA')?'RELATIONSHIP_SUPPORTED':hasDemand&&hasSupply?'PARTIALLY_SUPPORTED':hasDemand?'DEMOGRAPHIC_ONLY':hasSupply?'SUPPLY_ONLY':'INSUFFICIENT'},facilityDataGaps:[...row.gaps,...demandSupplyCompatibility(demand,metrics).reasons,...metrics.flatMap(m=>m.limitations),...(!indicators.length?['동일 지역·대상 정의·기준일의 수요/공급 비율 없음']:[]),'시설 공급 변화 데이터 미연결','공간 분포·접근성·이용 의향을 추가 확인해야 합니다.'],facilityRecords:mode==='live'?supply.flatMap(s=>s.records).filter(r=>r.regionCode===row.region.regionCode&&r.dataMode==='LIVE'):[],warnings:row.gaps,confidenceReasons:[relevant.length?'선택 이슈와 연결된 수요·공급 변화 관계가 있습니다.':'건축 이슈 관련성을 확인할 추가 근거가 필요합니다.','Issue Signal은 별도 근거 강도 평가 전까지 N/A입니다.']};
 });
 const positions=supplyIndicatorPositions(profiles.flatMap(p=>p.demandSupplyIndicators??[]));
 return profiles.map(p=>({...p,supplyRelativePositions:positions.filter(v=>v.regionCode===p.region.regionCode)}));
}
