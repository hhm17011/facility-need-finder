import type {RegionalMetric} from '../../services/regional/types';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {FacilityProfile} from '../../evidenceTypes';
import type {EvaluatedEvidenceItem} from '../../services/evidence/analysis/types';
import type {ArchitecturalIssue,Phenomenon} from '../../services/issues/types';
import {regionalEvidenceEngine} from '../../services/regional/engine';
import {regionalQueries} from '../../services/regional/requirements';
import {dimensionLabels,regionalConfig} from '../../services/regional/config';
import {discoverRegionalEvidence,type RegionalSearchState} from '../../services/regional/discovery';
import {analyzeEvidenceCollection} from '../../services/evidence/analysis/evidenceAnalyzer';
import {planEvidenceSearch} from '../../services/planEvidenceSearch';
import {getSearchConfiguration} from '../../services/evidence/evidenceExplorer';
import {GeographicOverview,type GeographicProgress} from '../GeographicOverview';
import {GeographicEvidenceList} from '../GeographicOverview/EvidenceList';
export function RegionalEvidenceExplorer({structuredMetrics=[],items,profile,issue,phenomena,mode,running,onStatus,onProblemGenerated}:{structuredMetrics?:RegionalMetric[];items:EvaluatedEvidenceItem[];profile:FacilityProfile;issue:ArchitecturalIssue;phenomena:Phenomenon[];mode:'demo'|'live';running:boolean;onStatus:(value:GeographicProgress)=>void;onProblemGenerated:(ready:boolean)=>void}){
 const [added,setAdded]=useState<EvaluatedEvidenceItem[]>([]);const [checked,setChecked]=useState<string[]>([]);
 const [search,setSearch]=useState<RegionalSearchState|null>(null);const [liveConfigured,setLiveConfigured]=useState(false);const [configError,setConfigError]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{const abort=new AbortController();getSearchConfiguration(abort.signal).then(config=>setLiveConfigured(config.liveConfigured)).catch(()=>{if(!abort.signal.aborted)setConfigError('검색 설정을 확인하지 못했습니다.');});return()=>{abort.abort();controller.current?.abort();controller.current=null;};},[]);
 const engine=useMemo(()=>regionalEvidenceEngine({facility:profile,issue,structuredMetrics,items:[...items,...added],mode,discoveredEvidenceIds:added.map(i=>i.id)}),[profile,issue,items,added,mode,structuredMetrics]);
 const discovered=engine.profiles.filter(p=>p.regionalAssessment?.administrativeLevel==='SIGUNGU');
 const enrichedIssue=useMemo(()=>({...issue,evidenceIds:[...new Set([...issue.evidenceIds,...engine.items.map(i=>i.id)])],conflictingEvidenceIds:[...new Set([...issue.conflictingEvidenceIds,...engine.profiles.flatMap(p=>p.regionalAssessment?.conflictingEvidenceIds??[])])]}),[issue,engine]);
 async function run(stage:'discovery'|'validation'){
  if(controller.current)return;const abort=new AbortController();controller.current=abort;
  const baseline=[...added];const plan=planEvidenceSearch(profile);
  try{await discoverRegionalEvidence(profile,issue,mode,discovered.filter(p=>checked.includes(p.region.id!)).map(p=>p.region),stage,abort.signal,state=>{
   if(controller.current!==abort)return;
   setSearch(state);const analyzed=analyzeEvidenceCollection(state.items,profile,plan);setAdded([...baseline,...analyzed]);
  });}finally{if(controller.current===abort)controller.current=null;}
 }
 const busy=running||!!search?.running;
 return <section className="regional-engine" aria-labelledby="regional-engine-title"><div className="section-heading"><div><span className="section-kicker">06 / REGIONAL EVIDENCE ENGINE</span><h2 id="regional-engine-title">지도에 표시하기 전, 지역 근거 확인</h2></div><span className={`mode-badge ${mode}`}>{mode==='demo'?'DEMO · 가상 탐색':'LIVE · 지역 자료 탐색'}</span></div>
  <p>선택 이슈: {issue.title}</p><p>발견 → 행정 단위 검증 → 지역 비교 → 직접 근거가 있는 시·군·구만 지도에 연결합니다.</p>
  <div className="regional-requirements">{engine.requirements.map(r=><article className="panel" key={r.id}><strong>{dimensionLabels[r.dimension]} · {r.importance==='required'?'중요':'보조'}</strong><p>{r.question}</p><small>시·군·구 우선 · 시·도는 맥락으로 보존</small><details><summary>확인할 지표</summary>{r.requiredMetrics.join(' / ')}</details></article>)}</div>
  <div className="panel regional-search-controls"><h3>A. 지역 발견</h3><p>지역을 미리 선정하지 않고 이슈 검증 질문으로 탐색합니다. 통계·공공 자료를 우선하며 증가·감소·충분·과잉도 확인합니다.</p>
   <details><summary>실행할 광역 탐색 검색어 · 최대 {regionalConfig.maxBroadQueries}개</summary><ul>{regionalQueries(profile,issue.issueType,'discovery').map(q=><li key={q.query}>{q.query}</li>)}</ul></details>
   {configError&&<p role="alert">{configError}</p>}{mode==='live'&&!liveConfigured&&<p>검색 API 미설정 · 기존 근거의 지역 검증은 계속 확인할 수 있습니다.</p>}
   <button className="primary-button" disabled={busy||mode==='live'&&!liveConfigured} onClick={()=>run('discovery')}>지역 근거 탐색</button>
   <h3>B. 발견 지역 검증</h3><p>직접 근거가 없는 언급 지역도 보존합니다. 최대 {regionalConfig.maxValidationRegions}개를 선택해 지역별 최대 {regionalConfig.maxQueriesPerRegion}개 검색어로 추가 검증합니다.</p>
   {discovered.map(p=><label className="regional-validation-choice" key={p.region.id}><input type="checkbox" checked={checked.includes(p.region.id!)} disabled={busy||!checked.includes(p.region.id!)&&checked.length>=regionalConfig.maxValidationRegions} onChange={event=>setChecked(value=>event.target.checked?[...value,p.region.id!]:value.filter(id=>id!==p.region.id))}/>{p.region.displayName} · {p.regionalAssessment?.status}</label>)}
   {!discovered.length&&<p>명시적으로 정규화된 시·군·구 발견 자료가 없습니다.</p>}
   <button className="secondary-button" disabled={busy||!checked.length||mode==='live'&&!liveConfigured} onClick={()=>run('validation')}>선택 지역 추가 검증</button>{search?.running&&<button className="secondary-button" onClick={()=>controller.current?.abort()}>지역 탐색 중단</button>}
   {search&&<p role="status">{search.stage==='discovery'?'지역 발견':'지역 검증'} {search.running?'진행 중':'종료'} · {search.completed}/{search.total} 자료 유형 요청 · {search.messages.join(' ')}</p>}
  </div>
  <section className="regional-comparison"><h3>C. 지역 비교 · 동일 조건 확인</h3><p>비교 가능 지표 그룹 {engine.comparisonGroups.length}개 · 직접 근거로 연결된 시·군·구 {engine.supportedRegions.length}개. 전체 지자체 순위가 아닙니다.</p>
   {!engine.comparisonGroups.length&&<p className="geographic-warning">동일 지표·행정 단위·연도·단위·정의·모집단으로 비교할 수 있는 지역 데이터가 부족합니다.</p>}
   {engine.comparisonGroups.map(group=><article className="panel" key={group.key}><h4>{group.metricType} · 같은 조건의 {group.regionIds.length}개 지역</h4><div className="regional-table-wrap"><table><thead><tr><th>지역</th><th>값</th><th>단위</th><th>기준 시점</th><th>출처</th></tr></thead><tbody>{engine.metrics.filter(m=>group.metricIds.includes(m.metricId)).map(m=><tr key={m.metricId}><td>{m.regionName}</td><td>{m.value}</td><td>{m.unit}</td><td>{m.referenceDate}</td><td>{m.sourceUrl?<a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">원문</a>:'원문 없음'}</td></tr>)}</tbody></table></div></article>)}
   <details><summary>발견한 지역 지표 전체 {engine.metrics.length}개 · 비교 불가 자료 포함</summary>{engine.metrics.map(m=><p key={m.metricId}>{m.regionName} · {m.metricType} · {m.value??'N/A'} {m.unit} · {m.referenceDate??'시점 미확인'} · {m.comparable?'비교 그룹 있음':'비교 보류'}<br/>{m.limitations.join(' ')}</p>)}</details>
  </section>
  <GeographicOverview regionalResult={engine} issue={enrichedIssue} phenomena={phenomena} profile={profile} items={engine.items} mode={mode} running={busy} onStatus={onStatus} onProblemGenerated={onProblemGenerated}/>
  <details className="panel regional-context"><summary>시·도 맥락 자료 {engine.parentContext.length}건 · 하위 지역 직접 근거로 사용하지 않음</summary><GeographicEvidenceList items={engine.parentContext}/></details>
 </section>;
}
