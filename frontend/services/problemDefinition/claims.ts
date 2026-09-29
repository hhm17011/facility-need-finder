import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { representativeSources } from '../geography/candidateScore';
import { referencesInText } from '../geography/regionNormalizer';
import { problemDefinitionConfig as config } from './config';
import type { ClaimType, EvidenceClaim, ProblemInput } from './types';
const normalized = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[。.!?]+$/, '');
const mean = (values: number[]) => values.length ? values.reduce((a,b) => a+b,0)/values.length : null;
function typeOf(text: string, stance: EvaluatedEvidenceItem['stance']): ClaimType {
  if (stance === 'WEAKENS_NEED') return 'CONTRADICTORY_SIGNAL';
  if (/인구|고령|출생|가구/.test(text) && /증가|감소|변화|전환|유지/.test(text)) return 'DEMOGRAPHIC_CHANGE';
  if (/접근|이동|거리/.test(text)) return 'ACCESSIBILITY';
  if (/부족|공급.*격차/.test(text)) return 'SUPPLY_SHORTAGE';
  if (/수요|요구|이용 의향/.test(text)) return 'USER_DEMAND';
  if (/법률|정책|조례|시행/.test(text)) return 'POLICY_CONTEXT';
  if (/변화|증가|감소|폐원|개발|유지|안정/.test(text)) return 'REGIONAL_CHANGE';
  return 'OTHER';
}
export function collectEvidence(input: ProblemInput): EvaluatedEvidenceItem[] {
  const seen = new Set<string>();
  return [...(input.region?.evidenceItems ?? []), ...input.nationalContext].filter(item => {
    if (item.mode !== input.mode || !input.issue.evidenceIds.includes(item.id) || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  });
}
export function extractClaims(input: ProblemInput, items = collectEvidence(input)): EvidenceClaim[] {
  const groups = new Map<string, EvidenceClaim>();
  const nationalIds = new Set(input.nationalContext.map(item => item.id));
  for (const item of items) {
    // Retain exact source text: no model paraphrase or unsupported extracted interpretation.
    const extracted = item.extractedClaims.filter(c => c.text.trim() && c.sourceExcerpt.includes(c.text));
    const passages = extracted.length ? extracted.map(c => ({text:c.text, field:'extractedClaims.sourceExcerpt', quote:c.sourceExcerpt, locator:c.sourceLocator, status:'extracted' as const}))
      : [{text:item.snippet.trim() || item.title, field:item.snippet.trim() ? 'snippet' : 'title', quote:item.snippet.trim() || item.title, locator:null, status:'metadata_only' as const}];
    for (const block of passages) for (const text of block.text.split(/(?<=[.!?。])\s+|\n+/).filter(text => text.trim())) {
      const passage = {...block, text: text.trim()};
      const national = nationalIds.has(item.id);
      // A document mentioning a place does not make all its claims local.
      const explicitRegions = referencesInText(passage.text).filter(r => r.normalizationStatus === 'matched');
      const local = !national && !!input.region && explicitRegions.some(r => r.id === input.region!.region.id) && explicitRegions.every(r => r.level1 === input.region!.region.level1 && (!r.level2 || r.level2 === input.region!.region.level2));
      const scope = national ? 'NATIONAL' : local ? 'REGIONAL' : 'UNKNOWN';
      const groupKey = `${scope}|${item.stance}|${normalized(passage.text)}`;
      let claim = groups.get(groupKey);
      if (!claim) {
        claim = {id:`claim-${groups.size+1}`,claim:passage.text,claimType:typeOf(passage.text,item.stance),evidenceIds:[],region:local ? input.region!.region:null,scope,strength:null,role:item.evidenceRole,stance:item.stance,quantitativeValues:[],sourceCount:0,conflictingEvidenceIds:[],passages:[],status:passage.status,usable:false,calculation:{dimensions:{},representativeIds:[],method:'equal_available_mean'},limitations:[]};
        groups.set(groupKey,claim);
      }
      if (!claim.evidenceIds.includes(item.id)) claim.evidenceIds.push(item.id);
      claim.passages.push({evidenceId:item.id,field:passage.field,quote:passage.quote,locator:passage.locator});
      if (passage.status === 'metadata_only') claim.status = 'metadata_only';
      // Numbers are literal excerpt tokens, not independently verified statistics.
      claim.quantitativeValues = [...new Set([...claim.quantitativeValues,...(passage.text.match(/\d[\d,.]*\s*(?:%|퍼센트|명|개소|개|년|개월|km|m²|㎡)/g) ?? [])])];
    }
  }
  return [...groups.values()].map(claim => {
    const sources=items.filter(item=>claim.evidenceIds.includes(item.id));
    const grouped=representativeSources(sources); const reps=grouped.capped.map(g=>g.item);
    const known=reps.filter(i=>i.evidenceRole!=='UNKNOWN');
    claim.sourceCount=grouped.identifiedGroups;
    claim.role=known.length===reps.length && known.every(i=>i.evidenceRole==='DIRECT') ? 'DIRECT' : known.length===reps.length && known.every(i=>i.evidenceRole==='CONTEXT') ? 'CONTEXT':'UNKNOWN';
    const dimensions={evidenceStrength:mean(reps.flatMap(i=>i.evidenceStrength===null?[]:[i.evidenceStrength])),independentSources:claim.sourceCount?Math.min(grouped.capped.filter(g=>g.identified).length/config.sourceTarget,1)*100:null,directness:known.length?known.filter(i=>i.evidenceRole==='DIRECT').length/known.length*100:null,regionalSpecificity:claim.scope==='REGIONAL'?(claim.region?.level2?100:60):null};
    const entries=Object.entries(dimensions).filter((entry):entry is [keyof typeof dimensions,number]=>entry[1]!==null);
    claim.strength=dimensions.evidenceStrength===null?null:Math.round(entries.reduce((s,[k,v])=>s+v*config.weights[k],0)/entries.reduce((s,[k])=>s+config.weights[k],0)*10)/10;
    claim.calculation={dimensions,representativeIds:reps.map(i=>i.id),method:'equal_available_mean'};
    const qualified=reps.length>0 && reps.every(i=>i.evaluation.relevance.status==='evaluated' && (i.evaluation.relevance.score??0)>=config.minimumRelevance && i.evaluationCompleteness.available/i.evaluationCompleteness.total>=config.minimumCompleteness);
    claim.usable=input.mode==='live' && claim.status==='extracted' && claim.scope!=='UNKNOWN' && qualified && claim.role!=='UNKNOWN' && (claim.strength??0)>=config.minimumStrength;
    if(claim.status==='metadata_only') claim.limitations.push('제목·검색 요약 인용이며 원문 주장 검증이 필요합니다.');
    if(claim.scope==='UNKNOWN') claim.limitations.push('인용문 자체에 선택 지역이 명시되지 않아 지역 문제의 증거로 사용하지 않습니다.');
    if(!qualified || claim.role==='UNKNOWN') claim.limitations.push('시설 관련성·직접성 또는 평가 완성도가 부족합니다.');
    claim.conflictingEvidenceIds=input.issue.conflictingEvidenceIds.filter(id=>!claim.evidenceIds.includes(id));
    if(claim.conflictingEvidenceIds.length)claim.limitations.push('같은 이슈에 상반된 방향의 자료가 있습니다. 수치를 차감하지 않고 함께 검토합니다.');
    if(claim.sourceCount<2) claim.limitations.push('독립 출처 교차 확인이 부족합니다.');
    if(input.mode==='demo') claim.limitations.push('DEMO 가상 자료이며 실제 사실의 근거로 사용할 수 없습니다.');
    return claim;
  });
}
