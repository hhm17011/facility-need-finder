import type {RegionalEngineInput,RegionalEngineResult,RegionalAssessment,RegionalEvidenceLink} from './types';
import {scoreRegion} from '../geography/candidateScore';
import {compareRegionalMetrics} from './metrics';
/** Provider-independent attachment of demographic facts. Facts alone never create issue support. */
export function attachStructuredData(result:RegionalEngineResult,input:RegionalEngineInput):RegionalEngineResult {
 if(input.mode!=='live')return result;
 const metrics=(input.structuredMetrics??[]).filter(m=>m.structuredSource?.mode==='live');
 if(!metrics.length)return result;
 const compared=compareRegionalMetrics([...result.metrics,...metrics]);
 const profiles=[...result.profiles];const evidenceLinks=[...result.evidenceLinks];
 for(const regionId of new Set(metrics.filter(m=>m.regionId&&m.structuredSource?.normalizationStatus==='MATCHED').map(m=>m.regionId!))){
  const rows=compared.metrics.filter(m=>m.regionId===regionId&&m.structuredSource?.mode==='live');
  const region=rows[0].structuredSource!.region;
  if(region.id!==regionId)continue;
  let profile=profiles.find(p=>p.region.id===regionId);
  if(!profile){
   const base=scoreRegion(region,[],[],'live');
   const a:RegionalAssessment={issueId:input.issue.id,issueTitle:input.issue.title,administrativeLevel:rows[0].administrativeLevel,status:'INSUFFICIENT',eligible:false,evidenceCoverage:Object.fromEntries(result.requirements.map(r=>[r.dimension,{status:'missing',evidenceIds:[]} as RegionalAssessment['evidenceCoverage']['DEMOGRAPHIC_CHANGE']])) as RegionalAssessment['evidenceCoverage'],coverageCount:0,coverageTotal:result.requirements.length,regionalMetrics:[],derivedIndicators:[],directEvidenceIds:[],supportingEvidenceIds:[],conflictingEvidenceIds:[],parentContextEvidenceIds:[],nationalContextEvidenceIds:[],links:[],dataGaps:result.requirements.map(r=>({region:region.displayName,missingDimension:r.dimension,message:`${r.question} · 이슈 검증 자료 필요`})),issueSignal:null,scoreDimensions:{},scoreCalculation:{weightedSum:0,weightSum:0,representativeIds:[],excludedIds:[]},limitations:[]};
   profile={...base,rank:null,candidateScore:null,confidence:'INSUFFICIENT',regionalAssessment:a};profiles.push(profile);
  }
  const previous=profile.regionalAssessment!;
  const links:RegionalEvidenceLink[]=rows.map(m=>({evidenceId:m.sourceEvidenceId,region,administrativeLevel:m.administrativeLevel,geographicEvidenceRole:'UNKNOWN',dataKind:'STRUCTURED_REGIONAL_DATA',dimensions:['DEMOGRAPHIC_CHANGE'],quote:m.sourceExcerpt,verified:m.verification==='source_verified',reason:'지역 인구 관찰값입니다. 시설 관련성과 건축 이슈의 직접 근거 여부는 별도 검증이 필요합니다.'}));
  evidenceLinks.push(...links);
  const coverage=structuredClone(previous.evidenceCoverage);
  if(coverage.DEMOGRAPHIC_CHANGE.status==='missing'&&rows.some(m=>m.verification==='source_verified'))coverage.DEMOGRAPHIC_CHANGE={status:'partial',evidenceIds:rows.filter(m=>m.verification==='source_verified').map(m=>m.sourceEvidenceId)};
  const updated={...profile,regionalAssessment:{...previous,evidenceCoverage:coverage,regionalMetrics:[...previous.regionalMetrics,...rows],links:[...previous.links,...links],limitations:[...new Set([...previous.limitations,'총인구는 시설 이용 대상 인구 또는 시설 부족을 의미하지 않습니다. 시설 공급 데이터 필요.'])]}};
  profiles[profiles.indexOf(profile)]=updated;
 }
 return {...result,profiles,supportedRegions:result.supportedRegions.map(p=>({...profiles.find(row=>row.region.id===p.region.id)!,rank:p.rank})),evidenceLinks,metrics:compared.metrics,comparisonGroups:compared.comparisonGroups};
}
