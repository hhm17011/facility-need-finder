import { useEffect, useState } from 'react';
import type { ProblemDefinition as Definition, ProblemInput, SectionDraft, SectionKey } from '../../services/problemDefinition/types';
import { editSection, generateProblemDefinition, regenerateSection, sectionLabels } from '../../services/problemDefinition/generator';
import { GeographicEvidenceList } from '../GeographicOverview/EvidenceList';
export function ProblemDefinition({input,running,onGenerated}:{input:ProblemInput;running:boolean;onGenerated:(ready:boolean)=>void}) {
  useEffect(()=>{onGenerated(false);},[onGenerated]);
  const [snapshot,setSnapshot]=useState<ProblemInput|null>(null);
  const [definition,setDefinition]=useState<Definition|null>(null);
  const [drafts,setDrafts]=useState<Partial<Record<SectionKey,SectionDraft>>>({});
  const [notice,setNotice]=useState('');
  function generate(){const saved=structuredClone({...input,referenceDate:new Date().toISOString()});setSnapshot(saved);setDefinition(generateProblemDefinition(saved));setDrafts({});onGenerated(true);}
  function regenerate(key:SectionKey){if(!snapshot || !definition)return;setDefinition({...definition,sections:{...definition.sections,[key]:regenerateSection(snapshot,key)}});setDrafts(previous=>{const next={...previous};delete next[key];return next;});setNotice(`${sectionLabels[key]}: 동일 근거로 재생성했습니다.`);}
  return <section className="problem-definition" aria-labelledby="problem-title"><div className="section-heading"><div><span className="section-kicker">08 / ARCHITECTURAL PROBLEM DEFINITION</span><h2 id="problem-title">건축적 문제제기</h2></div>{!definition&&<button className="primary-button" disabled={running} onClick={generate}>문제제기 정리</button>}</div>
    <p>선택 이슈와 지역의 근거를 발표 구조로 정리합니다. 부족한 항목은 판단을 보류합니다.</p>
    {definition&&<div className="problem-presentation"><p className={`mode-badge ${definition.mode}`}>{definition.mode==='demo'?'DEMO / MOCK · 가상 근거':'LIVE · 확보된 근거의 인용'} · {definition.region?.displayName??'지역 미선택'}</p><p>{definition.issue.title}</p><p className="muted">생성 시점의 근거를 보존합니다. 사용자 수정은 출처 검증 결과가 아닙니다. 항목 재생성 시 해당 수정만 초기화됩니다.</p>
      {(Object.keys(sectionLabels) as SectionKey[]).map(key=>{const section=definition.sections[key];const draft=drafts[key];return <article className={`problem-section panel ${draft?'user-edited':''}`} key={key}>
        <span className="section-kicker">{sectionLabels[key]}</span><div className="problem-section-status"><span>{draft?'사용자 수정 · 근거 일치 미검증':section.status==='limited'?'근거 부족 · 판단 보류':section.status==='question'?'열린 설계 질문 · 사실 주장 아님':'원문 인용 기반 · 사실 자체의 독립 검증 아님'}</span><button type="button" className="secondary-button" onClick={()=>regenerate(key)}>{sectionLabels[key].split(' · ')[0]} 다시 생성</button></div>
        <label>제목<input aria-label={`${key} 제목`} value={draft?.headline??section.headline} onChange={e=>setDrafts(previous=>({...previous,[key]:editSection(section,{headline:e.target.value,body:previous[key]?.body??section.body})}))}/></label>
        <label>{key==='designQuestion'?'설계 질문':'본문'}<textarea aria-label={`${key} 본문`} rows={key==='designQuestion'?3:5} value={draft?.body??section.body} onChange={e=>setDrafts(previous=>({...previous,[key]:editSection(section,{headline:previous[key]?.headline??section.headline,body:e.target.value})}))}/></label>
        <div className="source-chips" aria-label="생성 원문 출처"><span>{draft?'생성 원문 기준 근거':'근거'} {section.evidenceIds.length}개</span>{section.evidenceIds.map(id=>{const source=definition.evidenceItems.find(i=>i.id===id)!;return <a key={id} href={`#problem-source-${id}`} onClick={()=>{const details=document.getElementById(`problem-source-${id}`)?.closest("details");if(details)details.open=true;}}>{source.sourceOrganization??source.sourceLabel??'기관 미확인'} · {source.publishedDate?.slice(0,4)??'연도 미확인'}</a>;})}</div>
        <details><summary>생성 원문 · 주장 · 출처 추적</summary><p>{section.body}</p>{section.claimIds.map(id=>{const claim=definition.claims.find(c=>c.id===id)!;return <div key={id}><strong>{id} · {claim.scope} · Claim Strength {claim.strength??'미평가'}</strong><blockquote>{claim.claim}</blockquote><p>출처 그룹 {claim.sourceCount} · {claim.role} · {claim.stance}</p><ul>{claim.limitations.map(v=><li key={v}>{v}</li>)}</ul>{claim.passages.map((p,index)=><p key={index}>{p.field} {p.locator} <a href={`#problem-source-${p.evidenceId}`}>EvidenceItem {p.evidenceId}</a></p>)}<pre>{JSON.stringify(claim.calculation,null,2)}</pre></div>;})}{!section.claimIds.length&&<p>이 항목을 뒷받침할 주장이 없습니다.</p>}</details>
      </article>;})}
      <p role="status">{notice}</p>
      <aside className="geographic-warning"><h3>한계와 추가 확인 사항</h3><ul>{definition.limitations.map(v=><li key={v}>{v}</li>)}</ul></aside>
      <details><summary>검토할 주장 전체 {definition.claims.length}개 · 미지원 주장 보존</summary>{definition.claims.map(c=><article key={c.id}><strong>{c.id} · {c.scope} · {c.usable?'인용 가능':'추가 확인'} · {c.stance}</strong><blockquote>{c.claim}</blockquote><p>수치 토큰: {c.quantitativeValues.join(' / ')||'없음'} · 원문 수치의 정확성 미검증</p><p>{c.limitations.join(' ')}</p>{c.evidenceIds.map(id=><a key={id} href={`#problem-source-${id}`} onClick={()=>{const details=document.getElementById(`problem-source-${id}`)?.closest("details");if(details)details.open=true;}}>근거 {id} </a>)}</article>)}</details>
      <section className="region-evidence-group conflict"><h3>반대 또는 주의가 필요한 자료</h3><GeographicEvidenceList items={definition.evidenceItems.filter(i=>definition.issue.conflictingEvidenceIds.includes(i.id))} emptyMessage="미판정은 반대 자료가 없다는 뜻이 아닙니다."/></section>
      <details><summary>생성에 사용한 원본 근거 묶음 {definition.evidenceItems.length}개</summary>{definition.evidenceItems.map(item=><div id={`problem-source-${item.id}`} key={item.id}><GeographicEvidenceList items={[item]}/></div>)}</details>
    </div>}
  </section>;
}
