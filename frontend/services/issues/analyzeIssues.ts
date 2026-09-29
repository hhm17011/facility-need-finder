import type { FacilityProfile } from '../../evidenceTypes';
import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { representativeSources } from '../geography/candidateScore';
import { referencesInText } from '../geography/regionNormalizer';
import type { RegionReference } from '../geography/types';
import { issueConfig as config } from './config';
import type { ArchitecturalIssue, IssueAnalysis, Phenomenon, PhenomenonCategory, PhenomenonRelationship } from './types';
const key=(text:string)=>text.normalize('NFC').replace(/\s+/g,' ').trim();
const unique=<T,>(values:T[])=>[...new Set(values)];
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const patterns: [PhenomenonCategory,RegExp][]=[['SPATIAL',/접근|거리|생활권|공간.*불일치|입지/],['DEMOGRAPHIC',/인구|가구|세대|출생|고령/],['FACILITY',/시설|폐원|폐쇄|노후|유휴/],['USER',/이용|활동|요구|행태/],['URBAN',/개발|도시|산업|주거/],['POLICY',/정책|제도|법률|조례/],['SOCIAL',/가족|공동체|사회/],['ECONOMIC',/비용|소득|경제/],['ENVIRONMENTAL',/기후|환경|폭염/]];
const relationPattern=/불일치|격차|대비|반면|그러나|함께|동시에|연관|재사용|재활용|재배치|접근성.*저하|이용.*불편/;
const spatialPattern=/접근|거리|공간|입지|분포|생활권|재사용|재활용|유휴|노후|프로그램|활동/;
function regions(text:string): RegionReference[] {
  const refs=referencesInText(text).filter(r=>r.normalizationStatus==='matched');
  return refs.filter(r=>!refs.some(other=>other.id!==r.id && other.level1===r.level1 && (!r.level2 || other.level2===r.level2) && (other.level3 || (!r.level2 && other.level2))));
}
export function usableIssueEvidence(item: EvaluatedEvidenceItem): boolean {
  return item.mode==='live' && item.extractedClaims.some(c=>c.text.trim() && c.sourceExcerpt.includes(c.text)) && item.evaluation.relevance.status==='evaluated' && (item.evaluation.relevance.score??0)>=config.minimumRelevance && item.evaluationCompleteness.available/item.evaluationCompleteness.total>=config.minimumCompleteness;
}
/** Conservative lexical candidates only. Never infer causality from co-mention. */
export function analyzeIssues(items: EvaluatedEvidenceItem[], facility: FacilityProfile, mode:'demo'|'live'): IssueAnalysis {
  const evidence=items.filter(i=>i.mode===mode); const phenomena:Phenomenon[]=[]; const relationships:PhenomenonRelationship[]=[];
  const byText=new Map<string,Phenomenon>();
  for(const item of evidence){
    const extracted=item.extractedClaims.filter(c=>c.text.trim() && c.sourceExcerpt.includes(c.text));
    const passages=extracted.length?extracted.map(c=>({text:c.text,field:'extractedClaims.sourceExcerpt'})):[{text:item.snippet,field:'snippet'}];
    const national=/^(NATIONAL|전국|대한민국)$/i.test(item.geographicScope) || /전국|대한민국 전체/.test(passages.map(p=>p.text).join(' '));
    const local:Phenomenon[]=[];
    for(const passage of passages) for(const sentence of passage.text.split(/(?<=[.!?。])\s+|\n+/).filter(s=>s.trim().length>8)){
      const category=patterns.find(([,pattern])=>pattern.test(sentence))?.[0]; if(!category)continue;
      const text=key(sentence); const refs=national?[]:regions(text); const scope=national?'NATIONAL':refs.length?'REGIONAL':'UNKNOWN';
      const dedup=`${scope}|${text}`; let p=byText.get(dedup);
      if(!p){p={id:`phenomenon-${phenomena.length+1}`,title:text,description:text,category,direction:/증가|성장/.test(text)&&!/감소/.test(text)?'INCREASE':/감소|축소/.test(text)&&!/증가/.test(text)?'DECREASE':/유지|안정/.test(text)?'STABLE':/변화|이동/.test(text)?'CHANGE':'UNKNOWN',keywords:[],relatedFacility:facility.facilityName,affectedUsers:[...facility.primaryUsers],evidenceIds:[],regions:refs,confidence:null,scope,passages:[],status:mode==='demo'?'demo':extracted.length?'extracted':'metadata_only'};phenomena.push(p);byText.set(dedup,p);}
      if(!p.evidenceIds.includes(item.id))p.evidenceIds.push(item.id);
      p.passages.push({evidenceId:item.id,field:passage.field,quote:sentence});local.push(p);
    }
    const distinct=unique(local);
    for(let a=0;a<distinct.length;a++)for(let b=a+1;b<distinct.length;b++){
      const left=distinct[a],right=distinct[b];
      if(left.category===right.category)continue;
      // Explicit relationship must be in the same retrieved passage as both endpoints.
      const common=passages.find(p=>p.text.includes(left.title)&&p.text.includes(right.title));
      const explicit=!!common && relationPattern.test(common.text) && !/(불일치|격차|연관|관계)[^.!?。]{0,18}(없|않|미확인|확인되지)/.test(common.text);
      const commonRegions=left.regions.filter(r=>right.regions.some(o=>o.id===r.id));
      if(left.scope!==right.scope || (left.scope==='REGIONAL'&&!commonRegions.length))continue;
      let rel=relationships.find(r=>r.phenomenonA===left.id&&r.phenomenonB===right.id);
      if(!rel){rel={id:`relationship-${relationships.length+1}`,phenomenonA:left.id,phenomenonB:right.id,relationshipType:explicit&&/불일치/.test(common!.text)?'MISMATCH':explicit&&/격차/.test(common!.text)?'GAP':'COEXISTENCE',description:explicit?'같은 인용문에 관계 표현이 있습니다. 관계의 범위·방법은 원문 검토가 필요합니다.':'같은 자료에 언급된 현상입니다. 실제 동시 발생이나 인과관계를 확인한 것은 아닙니다.',evidenceIds:[],confidence:null,regions:commonRegions,explicit,passages:[]};relationships.push(rel);}
      rel.evidenceIds=unique([...rel.evidenceIds,item.id]); rel.passages.push({evidenceId:item.id,quote:common?.text??`${left.title}\n${right.title}`});
    }
  }
  for(const p of phenomena){const valid=evidence.filter(i=>p.evidenceIds.includes(i.id)&&usableIssueEvidence(i));p.confidence=mean(representativeSources(valid).capped.flatMap(g=>g.item.evidenceStrength===null?[]:[g.item.evidenceStrength]));}
  for(const r of relationships){const valid=evidence.filter(i=>r.evidenceIds.includes(i.id)&&usableIssueEvidence(i));r.confidence=r.explicit?mean(representativeSources(valid).capped.flatMap(g=>g.item.evidenceStrength===null?[]:[g.item.evidenceStrength])):null;}
  const issues:ArchitecturalIssue[]=[];
  for(const r of relationships){
    if(!r.explicit)continue;
    const linked=evidence.filter(i=>r.evidenceIds.includes(i.id));
    if(mode==='live' && !linked.some(usableIssueEvidence))continue;
    const ps=phenomena.filter(p=>[r.phenomenonA,r.phenomenonB].includes(p.id));const text=ps.map(p=>p.title).join(' ');
    if(!spatialPattern.test(text))continue;
    const type:ArchitecturalIssue['issueType']=/재사용|재활용|유휴/.test(text)?'ADAPTIVE_REUSE_OPPORTUNITY':/활동|프로그램/.test(text)&&/불일치|격차/.test(text)?'PROGRAM_MISMATCH':/접근|거리/.test(text)?'ACCESSIBILITY_GAP':/개발|성장/.test(text)&&/시설/.test(text)?'URBAN_GROWTH_LAG':/분포|생활권|입지/.test(text)?'SPATIAL_MISMATCH':/폐원|폐쇄/.test(text)?'FACILITY_DECLINE':'OTHER';
    const dimensions=type==='ADAPTIVE_REUSE_OPPORTUNITY'?['REUSE','ADAPTABILITY']:type==='PROGRAM_MISMATCH'?['PROGRAM','FACILITY TYPOLOGY']:type==='ACCESSIBILITY_GAP'?['ACCESSIBILITY','URBAN NETWORK']:['DISTRIBUTION','LOCATION'];
    const labels={ADAPTIVE_REUSE_OPPORTUNITY:'기존 공간의 활용 가능성',PROGRAM_MISMATCH:'활동 요구와 공간 구성',ACCESSIBILITY_GAP:'생활권과 시설 접근성',URBAN_GROWTH_LAG:'도시 변화와 시설 분포',SPATIAL_MISMATCH:'생활권과 시설 분포',FACILITY_DECLINE:'시설 변화와 공간 대응',OTHER:'현상 간 공간적 관계'};
    const title=`${facility.facilityName} · ${labels[type]}`;
    // Merge equivalent pattern + geography; keep every relationship and source.
    const existing=issues.find(i=>i.title===title&&i.relatedRegions.map(v=>v.id).sort().join()===r.regions.map(v=>v.id).sort().join());
    if(existing){existing.phenomenonIds=unique([...existing.phenomenonIds,...ps.map(p=>p.id)]);existing.relationshipIds.push(r.id);existing.evidenceIds=unique([...existing.evidenceIds,...r.evidenceIds]);continue;}
    issues.push({id:`issue-${issues.length+1}`,title,summary:'자료가 기술한 현상 사이의 공간적 관계를 검토하는 이슈 후보입니다.',issueType:type,phenomenonIds:ps.map(p=>p.id),relationshipIds:[r.id],evidenceIds:[...r.evidenceIds],relatedRegions:r.regions,architecturalRelevance:`${labels[type]}의 관계를 ${dimensions.join(' · ')} 관점에서 검토할 수 있는가?`,dimensions,confidence:'INSUFFICIENT',limitations:[],conflictingEvidenceIds:[],mode,confidenceCalculation:{sourceGroups:0,evidenceStrength:null,phenomenonConfidence:null,relationshipConfidence:null,sourceCategories:0,regionalEvidence:!!r.regions.length}});
  }
  for(const issue of issues){
    // Preserve counter-signals related to the same region and architectural vocabulary.
    const conflicts=evidence.filter(i=>i.stance==='WEAKENS_NEED'&&(issue.evidenceIds.includes(i.id)||issue.relatedRegions.some(r=>regions(i.snippet).some(v=>v.id===r.id))));
    issue.conflictingEvidenceIds=conflicts.map(i=>i.id);issue.evidenceIds=unique([...issue.evidenceIds,...issue.conflictingEvidenceIds]);
    const valid=evidence.filter(i=>issue.evidenceIds.includes(i.id)&&usableIssueEvidence(i)); const groups=representativeSources(valid);
    const reps=groups.capped.map(g=>g.item);const strength=mean(reps.flatMap(i=>i.evidenceStrength===null?[]:[i.evidenceStrength]));
    const pScores=phenomena.filter(p=>issue.phenomenonIds.includes(p.id)).map(p=>p.confidence);const rScores=relationships.filter(r=>issue.relationshipIds.includes(r.id)).map(r=>r.confidence);
    const pConfidence=pScores.every(s=>s!==null)?Math.min(...pScores as number[]):null;const rConfidence=rScores.every(s=>s!==null)?Math.min(...rScores as number[]):null;
    const categories=new Set(reps.map(i=>i.category)).size;
    issue.confidenceCalculation={sourceGroups:groups.identifiedGroups,evidenceStrength:strength,phenomenonConfidence:pConfidence,relationshipConfidence:rConfidence,sourceCategories:categories,regionalEvidence:!!issue.relatedRegions.length};
    const meets=(t:typeof config.high|typeof config.medium)=>groups.identifiedGroups>=t.sources&&categories>=t.categories&&(strength??0)>=t.strength&&(pConfidence??0)>=t.phenomenon&&(rConfidence??0)>=t.relationship&&issue.relatedRegions.length>0;
    issue.confidence=mode==='demo'?'INSUFFICIENT':meets(config.high)?'HIGH':meets(config.medium)?'MEDIUM':valid.length?'LOW':'INSUFFICIENT';
    if(conflicts.length){issue.confidence=issue.confidence==='HIGH'?'MEDIUM':issue.confidence==='MEDIUM'?'LOW':issue.confidence;issue.limitations.push('수요를 약화시키는 자료도 연결되어 있습니다. 동일 명제의 논리적 모순인지 추가 검토가 필요합니다.');}
    issue.limitations.push('원문 표현에 따른 보수적 관계 후보입니다. 인과관계·공간 실측·최종 해결책은 확정하지 않습니다.');
    if(groups.identifiedGroups<2)issue.limitations.push('독립 출처 교차 확인이 부족합니다.');
    if(!issue.relatedRegions.length)issue.limitations.push('관계 양쪽을 함께 뒷받침하는 지역 근거가 없습니다.');
    if(mode==='demo')issue.limitations.push('DEMO 가상 시나리오이며 실제 지역 현상이 아닙니다.');
  }
  return {phenomena,relationships,issues};
}
