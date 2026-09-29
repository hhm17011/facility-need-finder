import {attachStructuredData} from './structuredData';
import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { canonicalUrl } from '../evidence/evidenceNormalizer';
import { mapGeographicEvidence } from '../geography/geographicMapper';
import { normalizeRegion,referencesInText } from '../geography/regionNormalizer';
import { representativeSources,scoreRegion } from '../geography/candidateScore';
import type { RegionReference } from '../geography/types';
import { administrativeLevel,explicitScope,isParent } from './administrative';
import { regionalRequirements } from './requirements';
import { dimensionLabels,regionalConfig as config } from './config';
import { extractRegionalMetrics,compareRegionalMetrics,deriveFacilityPerThousand } from './metrics';
import type { RegionalAssessment,RegionalDimension,RegionalEngineInput,RegionalEngineResult,RegionalEvidenceLink } from './types';
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const uniq=<T,>(items:T[])=>[...new Set(items)];
const patterns:Record<RegionalDimension,RegExp>={DEMOGRAPHIC_CHANGE:/인구|가구|전입|전출|이동|고령|출생/,URBAN_CHANGE:/개발|도시|주거|산업단지|신도시/,FACILITY_CHANGE:/시설|폐원|폐쇄|정원|공급|노후|유휴/,DEMAND_SUPPLY:/수요|공급|이용률|충족률|과잉|대기|정원/,SPATIAL_CONDITION:/접근|거리|분포|생활권|공간|재사용/,DIRECT_LOCAL:/조사|설문|인터뷰|응답|표본/};
const dimensions=(quote:string)=>(Object.keys(patterns) as RegionalDimension[]).filter(key=>patterns[key].test(quote));
function qualified(item:EvaluatedEvidenceItem){return item.mode==='live'&&(item.evaluation.relevance.score??0)>=config.minimumRelevance&&item.evaluation.relevance.status==='evaluated'&&item.evaluationCompleteness.available/item.evaluationCompleteness.total>=config.minimumCompleteness;}
export function regionalEvidenceEngine(input:RegionalEngineInput):RegionalEngineResult {
 return attachStructuredData(regionalEvidenceCore(input),input);
}
function regionalEvidenceCore(input:RegionalEngineInput):RegionalEngineResult {
 const requirements=regionalRequirements(input.facility,input.issue);
 const ids=new Set([...input.issue.evidenceIds,...(input.discoveredEvidenceIds??[])]);
 const seen=new Set<string>();const items=input.items.filter(item=>{const key=item.url?canonicalUrl(item.url)??item.id:item.id;if(item.mode!==input.mode||!ids.has(item.id)||seen.has(key))return false;seen.add(key);return true;});
 const discovered=mapGeographicEvidence(items,input.mode);
 const rawMetrics=extractRegionalMetrics(items);
 const topics=[input.facility.facilityName,...input.facility.primaryUsers,...input.facility.mainFunctions].filter(Boolean);
 for(const metric of rawMetrics){const source=items.find(item=>item.id===metric.sourceEvidenceId)!;if(!qualified(source)||!topics.some(topic=>`${metric.sourceExcerpt} ${source.title}`.includes(topic)))metric.limitations.push('선택 시설·이슈의 지역 지표 관련성 확인이 필요합니다.');}
 const comparison=compareRegionalMetrics(rawMetrics);
 const globalLinks:RegionalEvidenceLink[]=[];
 for(const item of items){
  const claims=item.extractedClaims.filter(c=>c.text.trim()&&c.sourceExcerpt.includes(c.text));
  const blocks=claims.length?claims.map(c=>({quote:c.text,verified:true})):[{quote:`${item.title}\n${item.snippet}`,verified:false}];
  for(const block of blocks){
   const scope=explicitScope(item.geographicScope,block.quote);const ds=dimensions(block.quote);
   const linkedTopic=topics.some(term=>block.quote.includes(term));
   const verified=block.verified&&qualified(item)&&linkedTopic&&requirements.some(r=>r.importance==='required'&&ds.includes(r.dimension));
   globalLinks.push({evidenceId:item.id,region:scope.region,administrativeLevel:scope.level,geographicEvidenceRole:'UNKNOWN',dataKind:'UNSTRUCTURED_REGIONAL_EVIDENCE',dimensions:ds,quote:block.quote,verified,reason:verified?'원문 발췌·시설 관련성·명시 행정 단위를 확인했습니다.':'발견 메타데이터 또는 관련성 미평가 자료입니다. 직접 지역 근거로 승격하지 않습니다.'});
  }
  for(const metric of rawMetrics.filter(m=>m.sourceEvidenceId===item.id)){
   const region=normalizeRegion(metric.regionName);
   globalLinks.push({evidenceId:item.id,region:region.normalizationStatus==='matched'?region:null,administrativeLevel:metric.administrativeLevel,geographicEvidenceRole:'UNKNOWN',dataKind:'STRUCTURED_REGIONAL_DATA',dimensions:metric.dimension==='UNKNOWN'?[]:[metric.dimension],quote:metric.sourceExcerpt,verified:qualified(item)&&!metric.limitations.length,reason:metric.limitations.join(' ')||'원문 확인된 지역별 수치와 행정 단위입니다.'});
  }
 }
 const regions=new Map<string,RegionReference>();
 for(const profile of discovered.profiles)if(profile.region.id)regions.set(profile.region.id,profile.region);
 for(const link of globalLinks)if(link.region?.id&&link.region.normalizationStatus==='matched')regions.set(link.region.id,link.region);
 const nationalIds=new Set(globalLinks.filter(l=>l.administrativeLevel==='NATIONAL').map(l=>l.evidenceId));
 const nationalContext=items.filter(item=>nationalIds.has(item.id));
 const parentContext=items.filter(item=>globalLinks.some(l=>l.evidenceId===item.id&&l.administrativeLevel==='SIDO'));
 const profiles=[...regions.values()].filter(region=>region.normalizationStatus==='matched').map(region=>{
  const level=administrativeLevel(region.displayName,region);
  const links=globalLinks.flatMap<RegionalEvidenceLink>(link=>{
   if(link.administrativeLevel==='NATIONAL')return [{...link,geographicEvidenceRole:'NATIONAL_CONTEXT' as const}];
   if(link.region&&isParent(link.region,region)&&['SIDO','SIGUNGU'].includes(link.administrativeLevel))return [{...link,geographicEvidenceRole:'PARENT_CONTEXT' as const}];
   if(link.region?.id===region.id)return [{...link,geographicEvidenceRole:link.verified&&link.administrativeLevel===level?'DIRECT' as const:'UNKNOWN' as const}];
   if(!link.region&&referencesInText(link.quote).some(reference=>reference.id===region.id))return [{...link,geographicEvidenceRole:'UNKNOWN' as const,reason:'복수 지역 또는 불명확한 범위의 원문입니다. 발견 출처를 보존하지만 지역별 직접 근거로 나누지 않습니다.'}];
   return [];
  });
  const direct=links.filter(l=>l.geographicEvidenceRole==='DIRECT'&&l.administrativeLevel==='SIGUNGU');
  const directIds=uniq(direct.map(l=>l.evidenceId));const directItems=items.filter(item=>directIds.includes(item.id));
  const grouped=representativeSources(directItems);const reps=grouped.capped.map(g=>g.item);const scoredSourceCount=grouped.capped.filter(g=>g.identified).length;
  const evidenceCoverage=Object.fromEntries(requirements.map(requirement=>{
   const available=direct.filter(l=>l.dimensions.includes(requirement.dimension));const partial=links.filter(l=>l.dimensions.includes(requirement.dimension));
   return [requirement.dimension,{status:available.length?'available':partial.length?'partial':'missing',evidenceIds:uniq((available.length?available:partial).map(l=>l.evidenceId))}];
  })) as RegionalAssessment['evidenceCoverage'];
  const coverageCount=requirements.filter(r=>evidenceCoverage[r.dimension].status==='available').length;
  const requiredComplete=requirements.filter(r=>r.importance==='required').every(r=>evidenceCoverage[r.dimension].status==='available');
  const eligible=level==='SIGUNGU'&&direct.length>0;
  const support=directItems.filter(item=>item.stance==='SUPPORTS_NEED');
  const conflicts=directItems.filter(item=>item.stance==='WEAKENS_NEED');
  const stronglyOpposed=support.some(i=>(i.evidenceStrength??0)>=config.strongEvidence)&&conflicts.some(i=>(i.evidenceStrength??0)>=config.strongEvidence);
  const metrics=comparison.metrics.filter(m=>m.regionId===region.id&&directIds.includes(m.sourceEvidenceId));
  const metricConflictIds=uniq(metrics.filter(m=>m.limitations.some(l=>l.includes('수치가 상충'))).map(m=>m.sourceEvidenceId));
  const metricConflicts=metricConflictIds.length>0;
  const status:RegionalAssessment['status']=!eligible?'INSUFFICIENT':stronglyOpposed||metricConflicts?'CONFLICTING':scoredSourceCount>=config.supportedSources&&coverageCount>=config.supportedDimensions&&requiredComplete?'SUPPORTED':'PARTIALLY_SUPPORTED';
  const comparableMetrics=metrics.filter(m=>m.comparable);
  const relationshipItems=reps.filter(item=>input.issue.evidenceIds.includes(item.id)&&direct.some(l=>l.evidenceId===item.id&&/불일치|격차|반면|동시에|함께/.test(l.quote)));
  const scoreDimensions:RegionalAssessment['scoreDimensions']={
   strength:{score:mean(reps.flatMap(i=>i.evidenceStrength===null?[]:[i.evidenceStrength])),evidenceIds:reps.map(i=>i.id),reason:'출처 그룹당 1개·자료 유형당 최대 2개인 직접 근거 강도 평균'},
   coverage:{score:coverageCount/requirements.length*100,evidenceIds:directIds,reason:`직접 근거가 있는 차원 ${coverageCount}/${requirements.length}; 맥락 자료는 충족으로 세지 않음`},
   relationship:{score:relationshipItems.length?100:null,evidenceIds:relationshipItems.map(i=>i.id),reason:'원래 선택 이슈에 연결된 직접 발췌의 명시 관계 표현; 없으면 미평가'},
   comparability:{score:metrics.length?comparableMetrics.length/metrics.length*100:null,evidenceIds:uniq(metrics.map(m=>m.sourceEvidenceId)),reason:'동일 정의·단위·시점·모집단·경계의 비교 그룹에 속한 지표 비율'},
   sourceDiversity:{score:grouped.identifiedGroups?Math.min(grouped.capped.filter(g=>g.identified).length/config.sourceTarget,1)*100:null,evidenceIds:reps.map(i=>i.id),reason:'상한 적용한 식별 출처 대표 / 3; 기관·도메인은 독립성의 대리 지표'},
   completeness:{score:mean(reps.map(i=>i.evaluationCompleteness.available/i.evaluationCompleteness.total*100)),evidenceIds:reps.map(i=>i.id),reason:'직접 대표 근거의 기존 평가 완성도'},
  };
  const included=Object.entries(scoreDimensions).filter(([,d])=>d.score!==null);
  const weight=(key:string)=>config.weights[key as keyof typeof config.weights];
  const weightSum=included.reduce((s,[key])=>s+weight(key),0);const weightedSum=included.reduce((s,[key,d])=>s+d.score!*weight(key),0);
  const issueSignal=eligible&&scoreDimensions.strength.score!==null&&weightSum?Math.round(weightedSum/weightSum*10)/10:null;
  const baseItems=items.filter(item=>links.some(l=>l.evidenceId===item.id));
  const base=discovered.profiles.find(p=>p.region.id===region.id)??scoreRegion(region,[],[],input.mode);
  let confidence=eligible?(status==='SUPPORTED'&&scoredSourceCount>=config.highSources&&comparableMetrics.length>0&&relationshipItems.length>0&&coverageCount/requirements.length>=config.highCoverage?'HIGH':status==='SUPPORTED'&&coverageCount/requirements.length>=config.mediumCoverage?'MEDIUM':'LOW'):'INSUFFICIENT';
  if(status==='CONFLICTING'||conflicts.length)confidence='LOW';
  const dataGaps:RegionalAssessment['dataGaps']=requirements.filter(r=>evidenceCoverage[r.dimension].status!=='available').map(r=>({region:region.displayName,missingDimension:r.dimension,message:`${dimensionLabels[r.dimension]}의 시·군·구 직접 근거가 부족합니다.${evidenceCoverage[r.dimension].status==='partial'?' 맥락·미검증 자료만 확인되었습니다.':''}`}));
  if(!eligible)dataGaps.unshift({region:region.displayName,missingDimension:'DIRECT_REGIONAL',message:'시·군·구 단위 직접 근거가 부족합니다.'});
  if(!comparableMetrics.length)dataGaps.push({region:region.displayName,missingDimension:'COMPARABILITY',message:'타 지역과 동일 조건으로 비교 가능한 정량 지표가 없습니다.'});
  const derived=metrics.filter(m=>m.metricType==='target_population').flatMap(p=>metrics.filter(m=>m.metricType==='facility_count').flatMap(f=>{const result=deriveFacilityPerThousand(p,f);return result?[result]:[];}));
  const limitations=uniq([...metrics.flatMap(m=>m.limitations),...(input.mode==='demo'?['DEMO 가상 자료는 실제 지역의 직접 근거로 사용하지 않습니다.']:[])]);
  const assessment:RegionalAssessment={issueId:input.issue.id,issueTitle:input.issue.title,administrativeLevel:level,status,eligible,evidenceCoverage,coverageCount,coverageTotal:requirements.length,regionalMetrics:metrics,derivedIndicators:derived,directEvidenceIds:directIds,supportingEvidenceIds:support.map(i=>i.id),conflictingEvidenceIds:uniq([...conflicts.map(i=>i.id),...metricConflictIds]),parentContextEvidenceIds:uniq(links.filter(l=>l.geographicEvidenceRole==='PARENT_CONTEXT').map(l=>l.evidenceId)),nationalContextEvidenceIds:uniq(links.filter(l=>l.geographicEvidenceRole==='NATIONAL_CONTEXT').map(l=>l.evidenceId)),links,dataGaps,issueSignal,scoreDimensions,scoreCalculation:{weightedSum,weightSum,representativeIds:reps.map(i=>i.id),excludedIds:directItems.filter(i=>!reps.includes(i)).map(i=>i.id)},limitations};
  return {...base,evidenceItems:baseItems,rank:null,candidateScore:issueSignal,confidence:confidence as typeof base.confidence,regionalAssessment:assessment,warnings:dataGaps.map(g=>g.message),confidenceReasons:[`직접 출처 ${grouped.identifiedGroups}개 · 근거 범위 ${coverageCount}/${requirements.length}`,`상태 ${status} · 중요 차원 ${requiredComplete?'충족':'부족'}`],supportsNeed:support,weakensNeed:conflicts};
 });
 return {requirements,evidenceLinks:globalLinks,profiles,supportedRegions:profiles.filter(p=>p.regionalAssessment!.eligible).sort((a,b)=>(b.candidateScore??-1)-(a.candidateScore??-1)||a.region.displayName.localeCompare(b.region.displayName,'ko')).map((p,index)=>({...p,rank:index+1})),nationalContext,parentContext,items,metrics:comparison.metrics,comparisonGroups:comparison.comparisonGroups,unresolved:discovered.unresolved.map(u=>({evidenceId:u.evidence.id,reason:u.reason}))};
}
