import { EvidenceType } from '../../evidenceTypes';
import { collectEvidence, extractClaims } from './claims';
import { problemDefinitionConfig as config } from './config';
import type { EvidenceClaim, ProblemDefinition, ProblemInput, ProblemSection, SectionDraft, SectionKey } from './types';
export const sectionLabels: Record<SectionKey,string> = {
  background:'01 BACKGROUND · 변화의 배경', phenomena:'02 PHENOMENA · 함께 검토할 현상',
  architecturalIssue:'03 ARCHITECTURAL ISSUE · 공간적 질문', regionalExpression:'04 REGIONAL EXPRESSION · 지역에서의 표현', designQuestion:'05 DESIGN QUESTION · 설계 질문',
};
const uncertain='현재 확보된 근거만으로는 판단이 어렵습니다.';
const ids=(values:string[])=>[...new Set(values)];
export function generateProblemDefinition(input:ProblemInput):ProblemDefinition {
  const evidenceItems=collectEvidence(input);const claims=extractClaims(input,evidenceItems);
  const referenceDate=input.referenceDate??new Date().toISOString();const cutoff=new Date(referenceDate);cutoff.setUTCMonth(cutoff.getUTCMonth()-config.recentMonths);
  const dated=evidenceItems.filter(i=>i.publishedDate && Number.isFinite(Date.parse(i.publishedDate)) && Date.parse(i.publishedDate)<=Date.parse(referenceDate));
  const recent=new Set(dated.filter(i=>Date.parse(i.publishedDate!)>=cutoff.getTime()).map(i=>i.id));
  const usable=claims.filter(c=>c.usable && c.claim.length<=360).sort((a,b)=>(b.strength??0)-(a.strength??0));
  const national=usable.filter(c=>c.scope==='NATIONAL');const regional=usable.filter(c=>c.scope==='REGIONAL');
  const supportive=regional.filter(c=>c.stance!=='WEAKENS_NEED');const opposing=regional.filter(c=>c.stance==='WEAKENS_NEED');
  function section(headline:string, selected:EvidenceClaim[], note?:string):ProblemSection {
    const chosen=selected.slice(0,config.maximumClaimsPerSection);
    const statements=chosen.map(c=>({text:`${c.scope==='NATIONAL'?'전국 배경 자료':'선택 지역 자료'}의 인용: “${c.claim}”`,claimIds:[c.id],evidenceIds:c.evidenceIds}));
    const body=statements.length ? [...statements.map(s=>s.text),...(note?[note]:[])].join('\n') : `${uncertain}${note?` ${note}`:''}`;
    return {headline,body,claimIds:chosen.map(c=>c.id),evidenceIds:ids(chosen.flatMap(c=>c.evidenceIds)),status:statements.length?'supported':'limited',statements};
  }
  const changes=[...national,...regional].filter(c=>/변화|증가|감소|전환|이동|유지|안정|폐원|개발/.test(c.claim)&&c.evidenceIds.some(id=>recent.has(id)));
  const mixed=opposing.length?[...supportive.slice(0,1),opposing[0]]:regional;
  const spatial = regional.filter(c=>/공간|접근|거리|입지|분포|생활권|프로그램|활동|재사용|시설/.test(c.claim));
  const spatialOpposing = spatial.filter(c=>c.stance==='WEAKENS_NEED');
  const spatialMixed = spatialOpposing.length ? [...spatial.filter(c=>c.stance!=='WEAKENS_NEED').slice(0,1),spatialOpposing[0]] : spatial;
  const dimensionLabels:Record<string,string>={LOCATION:'입지',ACCESSIBILITY:'접근성',PROGRAM:'활동과 공간 구성',SCALE:'규모',DISTRIBUTION:'시설 분포',ADAPTABILITY:'적응성',REUSE:'재사용','URBAN NETWORK':'생활권 연결','FACILITY TYPOLOGY':'시설 유형'};
  const sections:ProblemDefinition['sections']={
    background:section('어떤 변화가 일어나고 있는가?',changes,'전국 자료의 변화가 선택 지역에도 나타난다고 단정하지 않습니다.'),
    phenomena:section('어떤 현상들을 함께 검토해야 하는가?',mixed.length?mixed:national),
    architecturalIssue:section('현상 사이에서 어떤 공간적 관계를 검토할 것인가?',spatialMixed,input.issue.architecturalRelevance),
    regionalExpression:section('이 지역에서 무엇이 확인되는가?',mixed),
    designQuestion:{headline:'건축적으로 무엇을 질문할 것인가?',body:`${input.region?.region.displayName??'지역 확인을 거친 생활권'}에서 ${input.facility.facilityName}의 공간적 역할을 ${input.issue.dimensions.map(d=>dimensionLabels[d]??d).join('·')} 관점에서 어떻게 검토할 수 있는가?`,claimIds:[],evidenceIds:[],status:'question',statements:[]},
  };
  // The open question is a design prompt, not a factual conclusion or predetermined solution.
  sections.designQuestion.claimIds=ids([...sections.architecturalIssue.claimIds,...sections.regionalExpression.claimIds]);
  sections.designQuestion.evidenceIds=ids([...sections.architecturalIssue.evidenceIds,...sections.regionalExpression.evidenceIds]);
  const unsupportedSections=(Object.keys(sections) as SectionKey[]).filter(k=>sections[k].status==='limited');
  const missingCategories=Object.values(EvidenceType).filter(type=>!evidenceItems.some(i=>i.categories.includes(type)));
  const outdatedEvidence=dated.filter(i=>Date.parse(i.publishedDate!)<cutoff.getTime()).map(i=>i.id);
  const undatedEvidence=evidenceItems.filter(i=>!dated.includes(i)).map(i=>i.id);
  const regionalEvidenceGaps=regional.length?[]:['선택 지역의 직접 인용·시설 관련성 평가가 충분한 주장이 없습니다.'];
  const limitations=[...input.issue.limitations,...regionalEvidenceGaps];
  if(!recent.size)limitations.push('최신 자료 부족: 발행일이 확인된 최근 36개월 자료가 없습니다.');
  if(!claims.some(c=>c.quantitativeValues.length))limitations.push('확인할 정량 정보가 없습니다. 수치를 생성하지 않습니다.');
  if(!regional.some(c=>c.role==='DIRECT'))limitations.push('지역 직접 근거 부족: 지명 언급과 시설 수요 확인은 다릅니다.');
  if(input.issue.conflictingEvidenceIds.length)limitations.push('상반된 방향의 자료가 존재합니다. 원문과 적용 범위를 함께 검토해야 합니다.');
  if(unsupportedSections.length)limitations.push('지원되지 않는 항목은 판단 보류로 남겼습니다.');
  if(input.mode==='demo')limitations.unshift('DEMO / MOCK · 실제 문제제기에 사용할 수 없는 가상 자료입니다.');
  return {facility:structuredClone(input.facility),issue:structuredClone(input.issue),region:input.region?structuredClone(input.region.region):null,mode:input.mode,generatedAt:referenceDate,sections,claims,supportingClaims:claims.filter(c=>c.stance==='SUPPORTS_NEED').map(c=>c.id),contradictoryClaims:claims.filter(c=>c.stance==='WEAKENS_NEED').map(c=>c.id),evidenceItems:structuredClone(evidenceItems),limitations:ids(limitations),gaps:{unsupportedSections,lowConfidenceClaims:claims.filter(c=>!c.usable||c.sourceCount<2).map(c=>c.id),missingCategories,regionalEvidenceGaps,outdatedEvidence,undatedEvidence}};
}
export function editSection(section: ProblemSection, patch: Partial<Pick<SectionDraft,'headline'|'body'>>):SectionDraft {
  return {headline:patch.headline??section.headline,body:patch.body??section.body,userEdited:true};
}
/** Restore just this section from the original evidence snapshot; never search again. */
export function regenerateSection(snapshot:ProblemInput,key:SectionKey):ProblemSection {
  return generateProblemDefinition(snapshot).sections[key];
}
