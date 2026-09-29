import type {RegionalMetric} from '../../services/regional/types';
import { RegionalEvidenceExplorer } from '../RegionalEvidence';
import { useEffect, useMemo, useState } from 'react';
import type { FacilityProfile } from '../../evidenceTypes';
import type { EvaluatedEvidenceItem } from '../../services/evidence/analysis/types';
import { analyzeIssues } from '../../services/issues/analyzeIssues';
import { type GeographicProgress } from '../GeographicOverview';
import { GeographicEvidenceList } from '../GeographicOverview/EvidenceList';
export interface IssueProgress { relationships: string; issues: string; problem: string }
export function IssueExplorer({structuredMetrics=[],items,profile,mode,running,onGeographyStatus,onIssueStatus}:{structuredMetrics?:RegionalMetric[];items:EvaluatedEvidenceItem[];profile:FacilityProfile;mode:'demo'|'live';running:boolean;onGeographyStatus:(value:GeographicProgress)=>void;onIssueStatus:(value:IssueProgress)=>void}){
  const analysis=useMemo(()=>analyzeIssues(items,profile,mode),[items,profile,mode]);
  const [selectedId,setSelectedId]=useState(''); const [generated,setGenerated]=useState(false);
  const selected=analysis.issues.find(issue=>issue.id===selectedId);
  const linked=useMemo(()=>items.filter(item=>selected?.evidenceIds.includes(item.id)),[items,selected]);
  useEffect(()=>{if(running){setSelectedId('');setGenerated(false);}},[running]);
  useEffect(()=>{if(!selected)onGeographyStatus({mapping:'이슈 선택 후 지역 연결',candidates:'이슈 선택 대기'});},[selected,onGeographyStatus]);
  useEffect(()=>{onIssueStatus({relationships:running?'관계 검토 중':`관계 검토 완료 · ${analysis.relationships.length}개`,issues:running?'근거 수집 중':`${mode==='demo'?'DEMO ':''}${analysis.issues.length}개 · ${selected?'선택됨':'선택 대기'}`,problem:generated?'정리 완료 · 근거 한계 확인':selected?'지역 선택 후 정리 가능':'이슈 선택 대기'});},[analysis.relationships.length,analysis.issues.length,mode,running,selected,generated,onIssueStatus]);
  return <section className="issue-explorer" aria-labelledby="issues-title"><div className="section-heading"><div><span className="section-kicker">04–05 / PHENOMENA → RELATIONSHIPS → ISSUES</span><h2 id="issues-title">발견된 건축 이슈</h2></div><span className={`mode-badge ${mode}`}>{mode==='demo'?'DEMO · 가상 시나리오':'LIVE · 근거 기반 검토'}</span></div>
    <p>현상 사이에 공간·접근·활용의 질문이 있는지 검토합니다. 자료의 동시 언급만으로 인과관계나 시설 부족을 판단하지 않습니다.</p>
    {!analysis.issues.length&&<p className="geographic-warning">{running?'현상과 관계를 확인할 자료를 모으고 있습니다.':'현재 근거만으로 건축 이슈를 도출하기 어렵습니다. 원문에 명시된 관계와 시설 관련성 확인이 필요합니다.'}</p>}
    <div className="issue-cards">{analysis.issues.map((issue,index)=><article className="panel issue-card" key={issue.id}><span className="section-kicker">{String(index+1).padStart(2,'0')} / {issue.issueType}</span><h3>{issue.title}</h3><p>{issue.summary}</p><p>{issue.architecturalRelevance}</p><p>관련 현상 {issue.phenomenonIds.length} · 근거 {issue.evidenceIds.length} · 관련 지역 {issue.relatedRegions.length}</p><p>Confidence: {issue.confidence}{mode==='demo'?' · 실제 관찰 아님':''}</p><button className="secondary-button" disabled={running} aria-pressed={selectedId===issue.id} onClick={()=>{setSelectedId(issue.id);setGenerated(false);}}>이슈 분석</button></article>)}</div>
    <details className="panel phenomenon-inventory"><summary>현상 인용 후보 {analysis.phenomena.length}개 · 확인 전 자료 포함</summary>{analysis.phenomena.map(p=><article key={p.id}><span>{p.category} · {p.scope} · {p.status}</span><blockquote>{p.title}</blockquote><p>근거 {p.evidenceIds.length}개 · 확신도 {p.confidence??'미평가'}</p>{p.evidenceIds.map(id=>{const item=items.find(i=>i.id===id)!;return item.url&&item.mode==='live'?<a key={id} href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗ </a>:<span key={id}>DEMO · 원문 없음 </span>;})}</article>)}</details>
    {selected&&<section className="issue-detail" aria-labelledby="issue-detail-title"><div className="section-heading"><h3 id="issue-detail-title">{selected.title}</h3><span>선택 이슈 · {selected.confidence}</span></div><h4>왜 건축적으로 다룰 수 있는가?</h4><p>{selected.architecturalRelevance}</p><ul>{selected.limitations.map(l=><li key={l}>{l}</li>)}</ul>
      <h4>관련 현상과 관계</h4><div className="relationship-diagram" aria-label="현상 관계 · 인과 방향을 뜻하지 않음">{analysis.relationships.filter(r=>selected.relationshipIds.includes(r.id)).map(r=><article className="panel relationship-row" key={r.id}><blockquote>{analysis.phenomena.find(p=>p.id===r.phenomenonA)?.title}</blockquote><div><strong>↔ {r.relationshipType}</strong><p>{r.description}</p><span>관계 확신도 {r.confidence??'미평가'}</span></div><blockquote>{analysis.phenomena.find(p=>p.id===r.phenomenonB)?.title}</blockquote><details><summary>관계 → 현상 → 근거 추적</summary>{r.passages.map((p,index)=><div key={index}><blockquote>{p.quote}</blockquote><a href={`#issue-source-${p.evidenceId}`} onClick={()=>{const target=document.getElementById(`issue-source-${p.evidenceId}`);const details=target?.closest('details');if(details)details.open=true;}}>근거 {p.evidenceId}</a></div>)}</details></article>)}</div>
      <details><summary>이슈 확신도 산정 · 과학적 검증 점수 아님</summary><pre>{JSON.stringify(selected.confidenceCalculation,null,2)}</pre><p>독립 출처·자료 유형·근거 강도·현상과 관계의 확신도·지역 근거를 함께 봅니다. 상반된 자료가 있으면 확신도를 낮춥니다.</p></details>
      <section className="region-evidence-group conflict"><h4>상반된 방향·주의가 필요한 근거</h4><GeographicEvidenceList items={linked.filter(i=>selected.conflictingEvidenceIds.includes(i.id))} emptyMessage="판정된 상반 자료가 없습니다. 미판정 자료는 검토가 필요합니다."/></section>
      <details><summary>이슈 연결 근거 {linked.length}개</summary>{linked.map(item=><div key={item.id} id={`issue-source-${item.id}`}><GeographicEvidenceList items={[item]}/></div>)}</details>
      <RegionalEvidenceExplorer structuredMetrics={structuredMetrics} key={selected.id} issue={selected} phenomena={analysis.phenomena.filter(p=>selected.phenomenonIds.includes(p.id))} profile={profile} items={linked} mode={mode} running={running} onStatus={onGeographyStatus} onProblemGenerated={setGenerated}/>
    </section>}
  </section>;
}
