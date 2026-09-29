import {SigunguExplorer} from '../SigunguExplorer';
import {PopulationData} from '../PopulationData';
import type {RegionalMetric} from '../../services/regional/types';
import { IssueExplorer, type IssueProgress } from '../IssueExplorer';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceSearchPlan, FacilityProfile, EvidenceType } from '../../evidenceTypes';
import { exploreEvidence, getSearchConfiguration, initialDiscovery } from '../../services/evidence/evidenceExplorer';
import type { DiscoveryState, SearchConfiguration, SearchMode, SearchStatus } from '../../services/evidence/types';
import { analyzeEvidenceCollection } from '../../services/evidence/analysis/evidenceAnalyzer';
import { matchesQuality, selectTopEvidence, sortEvidence, summarizeAnalysis } from '../../services/evidence/analysis/selection';
import type { EvidenceSort, QualityFilter } from '../../services/evidence/analysis/types';
import { EvidenceAssessment, EvidenceAnalysisSummary } from '../EvidenceAssessment';
import { type GeographicProgress } from '../GeographicOverview';
const statusLabels: Record<SearchStatus, string> = { waiting: '대기', searching: '탐색 중', complete: '완료', partial: '일부 실패', error: '연결 실패', unconfigured: 'API 미설정', cancelled: '중단' };
interface Props { onIssueStatus: (value: IssueProgress) => void; profile: FacilityProfile; plan: EvidenceSearchPlan; onStatus: (status: string) => void; onAnalysisStatus: (status: string) => void; onGeographyStatus: (status: GeographicProgress) => void }
export function EvidenceExplorer({ profile, plan, onStatus, onAnalysisStatus, onGeographyStatus, onIssueStatus }: Props) {
  const [structuredMetrics,setStructuredMetrics]=useState<RegionalMetric[]>([]);
  const [mode, setMode] = useState<SearchMode>('live');
  const [config, setConfig] = useState<SearchConfiguration | null>(null);
  const [configError, setConfigError] = useState('');
  const [state, setState] = useState<DiscoveryState>(() => initialDiscovery(plan, 'live'));
  const [category, setCategory] = useState<EvidenceType | 'all'>('all');
  const [region, setRegion] = useState('all');
  const [sort, setSort] = useState<EvidenceSort>('strength');
  const [quality, setQuality] = useState<QualityFilter>('all');
  const [referenceDate, setReferenceDate] = useState(() => new Date().toISOString());
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const configController = new AbortController();
    getSearchConfiguration(configController.signal).then(setConfig).catch(() => {
      if (!configController.signal.aborted) setConfigError('검색 설정을 확인하지 못했습니다. 로컬 서버 연결을 확인해 주세요.');
    });
    return () => { mounted.current = false; configController.abort(); controller.current?.abort(); };
  }, []);
  function changeMode(next: SearchMode) {
    controller.current?.abort(); controller.current = null;
    setStructuredMetrics([]); setMode(next); setState(initialDiscovery(plan, next)); setCategory('all'); setRegion('all'); setSort('strength'); setQuality('all');
    onIssueStatus({relationships:'근거 탐색 후 대기',issues:'관계 검토 후 대기',problem:'이슈 선택 대기'}); onStatus('계획 완료 · 탐색 대기'); onAnalysisStatus('탐색 후 평가 대기'); onGeographyStatus({ mapping: '근거 평가 후 대기', candidates: '지역 연결 후 대기' });
  }
  async function start() {
    if (controller.current) return;
    const request = new AbortController(); controller.current = request;
    setReferenceDate(new Date().toISOString());
    setCategory('all'); setRegion('all'); setSort('strength'); setQuality('all');
    try {
      await exploreEvidence(profile, plan, mode, next => {
        if (!mounted.current || controller.current !== request) return;
        setState(next);
        const hasProblems = next.categories.some(item => ['error', 'partial', 'unconfigured', 'cancelled'].includes(item.status));
        onStatus(`${mode === 'demo' ? 'DEMO ' : ''}${next.running ? '탐색 중' : hasProblems ? '탐색 종료 · 상태 확인' : '탐색 완료'}`);
      }, request.signal);
    } finally { if (controller.current === request) controller.current = null; }
  }
  const regions = [...new Set(state.items.flatMap(item => item.mentionedRegions.map(region => region.name)))].sort();
  const evaluated = useMemo(() => analyzeEvidenceCollection(state.items, profile, plan, { referenceDate }), [state.items, profile, plan, referenceDate]);
  const filtered = sortEvidence(evaluated.filter(item => (category === 'all' || item.categories.includes(category)) && (region === 'all' || item.mentionedRegions.some(found => found.name === region)) && matchesQuality(item, quality)), sort);
  const summary = summarizeAnalysis(evaluated);
  const top = selectTopEvidence(filtered);
  useEffect(() => {
    onAnalysisStatus(!state.started ? '탐색 후 평가 대기' : state.running ? '도착 자료 평가 중' : evaluated.length ? `${mode === 'demo' ? 'DEMO ' : ''}메타데이터 평가 완료 · 의미 분석 미실행` : '평가할 자료 없음');
  }, [state.started, state.running, evaluated.length, mode, onAnalysisStatus]);
  const labels = Object.fromEntries(plan.evidenceCategories.map(item => [item.type, item.label]));
  return <section className="explorer-section" aria-labelledby="explorer-title">
    <div className="section-heading"><div><span className="section-kicker">03 / SOURCE DISCOVERY</span><h2 id="explorer-title">탐색된 근거</h2></div><span className={`mode-badge ${mode}`}>{mode === 'demo' ? 'DEMO · 가상 자료' : 'LIVE · 실제 출처 검색'}</span></div>
    <div className="discovery-controls panel">
      <div className="mode-controls" role="group" aria-label="검색 모드">
        <button type="button" aria-pressed={mode === 'demo'} onClick={() => changeMode('demo')} disabled={state.running}>DEMO</button>
        <button type="button" aria-pressed={mode === 'live'} onClick={() => changeMode('live')} disabled={state.running}>실데이터 탐색</button>
      </div>
      <p>{mode === 'demo' ? '동작 확인용 가상 자료입니다. 실제 근거·통계·원문 링크를 포함하지 않습니다.' : '검색 제공자가 반환한 제목·스니펫·원문 링크를 탐색합니다. 원문 내용을 검증하거나 결론을 생성하지 않습니다.'}</p>
      {configError && <p role="alert">{configError}</p>}
      {!config && !configError && <p>검색 설정 확인 중…</p>}
      {config && !config.liveConfigured && <p className="configuration-notice">연결된 실데이터 제공자가 없습니다. DEMO 모드만 이용할 수 있습니다.</p>}
      {config&&mode==='live'&&<div className="search-limits">실데이터 제공자: {config.providers.map(provider=><span key={provider.id}> {provider.configured?'●':'○'} {provider.label} · {provider.configured?'LIVE / AVAILABLE':'NOT CONNECTED'}</span>)}</div>}
      {config && <p className="search-limits">카테고리당 최대 {config.queriesPerCategory}개 검색어 · 검색어당 최대 {config.resultsPerQuery}개 결과 · 순차 실행{mode === 'live' ? ` · 연결: ${config.liveProvider}` : ' · 제공자: demo-fixture'}</p>}
      {plan.requiresClarification && <p>시설 해석 확인이 필요한 임시 계획으로 탐색합니다.</p>}
      <div className="search-actions"><button type="button" className="primary-button" onClick={start} disabled={state.running || !config || (mode === 'live' && !config.liveConfigured)}>{state.running ? '근거 탐색 중…' : state.started ? '다시 탐색하기' : '근거 탐색 시작'}</button>{state.running && <button type="button" className="secondary-button" onClick={() => controller.current?.abort()}>탐색 중단</button>}</div>
    </div>
    <SigunguExplorer key={`sigungu:${mode}`} mode={mode} profile={profile}/>
    <details><summary>기존 총인구 전용 조회 · DT_1B040A3</summary><PopulationData key={mode} mode={mode} profile={profile} onMetrics={setStructuredMetrics}/></details>
    {state.started && <>
      <div className="search-progress" aria-label="카테고리별 탐색 상태">{state.categories.map(progress => <div key={progress.category} className={`progress-item ${progress.status}`}><strong>{progress.label}</strong><span>{statusLabels[progress.status]}</span>{progress.cachedQueries > 0 && <small>캐시 {progress.cachedQueries}건</small>}{progress.message && <p>{progress.message}</p>}</div>)}</div>
      <div className="discovery-summary" role="status">{state.running ? '근거 탐색 중…' : '탐색 종료'} · {mode === 'demo' ? '가상 자료' : '관련 근거 발견'} 전체 {state.items.length}건 · 표시 {filtered.length}건</div>
      <EvidenceAnalysisSummary summary={summary} top={top} mode={mode} running={state.running} />
      <div className="evidence-filters" role="group" aria-label="근거 유형 필터"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>전체 {state.items.length}</button>{plan.evidenceCategories.map(item => <button type="button" key={item.type} aria-pressed={category === item.type} onClick={() => setCategory(item.type)}>{item.label} {state.items.filter(found => found.categories.includes(item.type)).length}</button>)}</div>
      <div className="region-filter"><label htmlFor="detected-region">언급된 지역</label><select id="detected-region" value={region} onChange={event => setRegion(event.target.value)}><option value="all">전체 지역</option>{regions.map(name => <option key={name}>{name}</option>)}</select><span>제목·스니펫의 명시적 지명만 표시합니다.</span></div>
      <div className="analysis-filters"><label htmlFor="evidence-sort">정렬</label><select id="evidence-sort" value={sort} onChange={event => setSort(event.target.value as EvidenceSort)}><option value="strength">근거 강도순</option><option value="newest">최신순 · 발행일 기준</option><option value="category">유형순</option></select><label htmlFor="evidence-quality">평가 필터</label><select id="evidence-quality" value={quality} onChange={event => setQuality(event.target.value as QualityFilter)}><option value="all">전체 근거</option><option value="strong">강한 근거</option><option value="direct">직접 근거</option><option value="regional">지역 근거 · 명시 지명</option></select></div>
      <p className="discovery-note">분류는 검색 목적에 따른 임시 분류입니다. 동일 자료가 여러 유형에 포함될 수 있어 유형별 건수의 합은 전체와 다를 수 있습니다. 발견은 결론이 아닙니다.</p>
      {!filtered.length && <div className="no-evidence">{state.running ? '확인 가능한 자료를 기다리고 있습니다.' : state.items.length ? '선택한 필터에 해당하는 근거가 없습니다.' : '확인 가능한 근거를 찾지 못했습니다.'}</div>}
      <div className="discovery-results">{filtered.map(item => <article className="discovery-card panel" key={item.id}>
        <div className="discovery-card-top"><span>{item.categories.map(type => labels[type]).join(' / ')}</span><span className={`mode-badge ${item.mode}`}>{item.mode === 'demo' ? 'MOCK DATA' : 'LIVE · 메타데이터 평가'}</span></div>
        <h3>{item.title}</h3><p className="source-snippet">{item.snippet || '제공된 스니펫이 없습니다.'}</p><span className="snippet-label">{item.mode === 'demo' ? 'DEMO 표시 예시' : '검색 제공자의 발견 메타데이터 · 원문 해석 아님'}</span>
        <dl className="source-metadata"><div><dt>출처 기관</dt><dd>{item.sourceOrganization || '기관 미확인'}</dd></div><div><dt>사이트 표시명</dt><dd>{item.sourceLabel || '미제공'}{item.url && <span> · {new URL(item.url).hostname}</span>}</dd></div><div><dt>발행일</dt><dd>{item.publishedDate || '확인되지 않음'}</dd></div><div><dt>발견 시각</dt><dd>{new Date(item.retrievedAt).toLocaleString('ko-KR')}</dd></div><div><dt>언급된 지역</dt><dd>{item.mentionedRegions.map(region => region.name).join(' / ') || '감지된 지역 없음'}</dd></div><div><dt>검색 제공자</dt><dd>{item.provider}</dd></div></dl>
        <EvidenceAssessment item={item} />
        <div className="source-link">{item.mode === 'live' && item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a> : <span>DEMO · 원문 없음</span>}</div>
      </article>)}</div>
      <IssueExplorer structuredMetrics={structuredMetrics} items={evaluated} profile={profile} mode={mode} running={state.running} onGeographyStatus={onGeographyStatus} onIssueStatus={onIssueStatus} />
    </>}
  </section>;
}
