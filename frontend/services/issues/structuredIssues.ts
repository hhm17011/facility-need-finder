import type {ArchitecturalIssue} from './types';
import type {RegionEvidenceProfile} from '../geography/types';
export function synthesizeStructuredIssues(profiles:RegionEvidenceProfile[]):ArchitecturalIssue[]{
 return profiles.filter(p=>p.mode==='live').flatMap(p=>(p.demandSupplyRelationships??[]).filter(r=>r.dataMode==='LIVE'&&r.type!=='INSUFFICIENT_DATA').map(r=>({id:`structured-issue:${r.id}`,title:r.type==='SUPPLY_DEMAND_DIVERGENCE'?'변화하는 이용자 규모와 기존 시설 공급의 관계':r.type==='POSSIBLE_OVERSUPPLY'?'이용자 감소에 따른 기존 시설의 활용 가능성':'대상 인구와 시설 공급 변화에 따른 공간 운영 질문',summary:r.description,issueType:r.type==='POSSIBLE_OVERSUPPLY'?'ADAPTIVE_REUSE_OPPORTUNITY':'SUPPLY_DEMAND_MISMATCH',phenomenonIds:(p.demographicPhenomena??[]).map(v=>v.id),relationshipIds:[r.id],evidenceIds:r.inputMetricIds,relatedRegions:[p.region],architecturalRelevance:'재배치·공간 공유·프로그램 전환 가능성을 조사할 질문입니다. 신축 또는 최종 부지를 처방하지 않습니다.',dimensions:['DEMOGRAPHIC_CHANGE','FACILITY_CHANGE'],confidence:'LOW',limitations:['시설의 공간 분포·접근성·실제 이용 수요 검증 필요','비율이나 변화 방향은 시설 부족을 직접 증명하지 않습니다.'],conflictingEvidenceIds:[],mode:'live',confidenceCalculation:{sourceGroups:2,evidenceStrength:null,phenomenonConfidence:null,relationshipConfidence:null,sourceCategories:1,regionalEvidence:true}})));
}

/** Adapter into the existing phenomenon graph; values are taken only from validated relationship inputs. */
export function structuredPhenomenonGraph(profile:RegionEvidenceProfile):import('./types').IssueAnalysis {
 const phenomena:import('./types').Phenomenon[]=[];
 const relationships:import('./types').PhenomenonRelationship[]=[];
 if(profile.mode!=='live')return {phenomena,relationships,issues:[]};
 for(const relation of profile.demandSupplyRelationships??[]){
  if(relation.dataMode!=='LIVE'||relation.type==='INSUFFICIENT_DATA')continue;
  const ids=[`${relation.id}:demand`,`${relation.id}:supply`];
  for(const [index,category] of (['DEMOGRAPHIC','FACILITY'] as const).entries()){
   phenomena.push({id:ids[index],title:index===0?'대상 인구의 기간별 변화':'시설 공급의 기간별 변화',category,description:relation.description,direction:'CHANGE',keywords:[],relatedFacility:profile.facilitySupplyMetrics?.[0]?.facilityType??'',affectedUsers:[],evidenceIds:relation.inputMetricIds.slice(index*2,index*2+2),regions:[profile.region],confidence:null,scope:'REGIONAL',passages:[],status:'extracted'});
  }
  relationships.push({id:relation.id,phenomenonA:ids[0],phenomenonB:ids[1],relationshipType:relation.type,description:relation.description,evidenceIds:relation.inputMetricIds,confidence:null,regions:[profile.region],explicit:true,passages:[]});
 }
 const issues=synthesizeStructuredIssues([profile]).map(issue=>({...issue,phenomenonIds:relationships.filter(r=>issue.relationshipIds.includes(r.id)).flatMap(r=>[r.phenomenonA,r.phenomenonB])}));
 return {phenomena,relationships,issues};
}
