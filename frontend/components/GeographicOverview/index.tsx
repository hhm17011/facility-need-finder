import type { FacilityProfile } from '../../evidenceTypes';
import type { ArchitecturalIssue, Phenomenon } from '../../services/issues/types';
import { ProblemDefinition } from '../ProblemDefinition';
import { useEffect, useState } from 'react';
import type { EvaluatedEvidenceItem } from '../../services/evidence/analysis/types';
import type { RegionalEngineResult } from '../../services/regional/types';
import { KoreaMap } from '../KoreaMap';
import { RankingPanel } from '../RankingPanel';
import { RegionDetail } from '../RegionDetail';
import { GeographicEvidenceList } from './EvidenceList';
export interface GeographicProgress { mapping: string; candidates: string }
export function GeographicOverview({ regionalResult, mode, running, onStatus, issue, phenomena, profile, onProblemGenerated }: { regionalResult: RegionalEngineResult; issue: ArchitecturalIssue; phenomena: Phenomenon[]; profile: FacilityProfile; onProblemGenerated: (ready:boolean) => void; items: EvaluatedEvidenceItem[]; mode: 'demo' | 'live'; running: boolean; onStatus: (status: GeographicProgress) => void }) {
  const result = {profiles:regionalResult.profiles,candidates:regionalResult.supportedRegions,nationalContext:regionalResult.nationalContext,unresolved:regionalResult.unresolved};
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const visible = result.candidates.filter(profile => profile.region.displayName.includes(search.trim()));
  const selected = selectedId ? result.profiles.find(profile => profile.region.id === selectedId) ?? null : visible[0] ?? null;
  useEffect(() => { onStatus({ mapping: `${mode === 'demo' ? 'DEMO ' : ''}${running ? '지역 근거 탐색 중' : '지역 근거 검증 완료'}`, candidates: `${mode === 'demo' ? 'DEMO ' : ''}${running ? '자료 비교 중' : '지역 비교 완료'} · ${result.candidates.length}개` }); }, [mode, running, result.candidates.length, onStatus]);
  function filter(value: string) { setSearch(value); setSelectedId(''); }
  return <section className="geographic-overview" aria-labelledby="geographic-title">
    <div className="section-heading"><div><span className="section-kicker">08 / VALIDATED REGIONS → MAP</span><h2 id="geographic-title">지역 검증 결과를 지도에서 확인</h2></div><span className={`mode-badge ${mode}`}>{mode === 'demo' ? 'DEMO · 가상 근거 연결' : 'LIVE · 명시 지명 연결'}</span></div>
    <p className="discovery-note">Issue Signal은 선택 이슈에 연결된 지역 자료의 신호를 나타냅니다. 최적 부지·필지·건축 위치를 선정한 결과가 아닙니다. 기관·도메인 그룹은 독립 출처의 대리 지표입니다.</p>
    <div className="geographic-overview-counts">연결 지역 {result.profiles.length}개 · 후보 {result.candidates.length}개 · 전국 배경 {result.nationalContext.length}건 · 위치 확인 필요 {result.unresolved.length}건</div>
    {result.candidates.length === 0 && <p className="geographic-warning">현재 확보된 시·군·구 단위 근거에서 선택한 건축 이슈가 충분히 확인된 지역이 없습니다.</p>}
    <div className="region-search"><label htmlFor="candidate-region-search">관련 지역 찾기</label><input id="candidate-region-search" value={search} onChange={event => filter(event.target.value)} placeholder="광주, 용인, 평택" /></div>
    <div className="analysis-grid"><KoreaMap regions={result.candidates.filter(profile => profile.region.displayName.includes(search.trim()))} selectedCode={selectedId || selected?.region.id || ''} onSelect={setSelectedId} /><RankingPanel regions={visible} selectedCode={selected?.region.id ?? ''} onSelect={setSelectedId} /></div>
    {result.profiles.some(profile => !profile.regionalAssessment?.eligible) && <details className="insufficient-regions panel"><summary>추가 확인 지역 · 검증 보류 {result.profiles.filter(profile => !profile.regionalAssessment?.eligible).length}개</summary><p>지역 표기는 연결했지만 직접 지역 근거를 확인하지 못했습니다. 지도 이슈 표시에는 포함하지 않습니다.</p>{result.profiles.filter(profile => !profile.regionalAssessment?.eligible).map(profile => <button key={profile.region.id} type="button" aria-pressed={selected?.region.id === profile.region.id} onClick={() => setSelectedId(profile.region.id!)}>{profile.region.displayName} · {profile.metrics.totalEvidence}건 · INSUFFICIENT</button>)}</details>}
    {selected && <RegionDetail key={selected.region.id} region={selected} phenomena={phenomena.filter(p => p.regions.some(r => r.id === selected.region.id))} />}
    <ProblemDefinition key={`${issue.id}-${selected?.region.id ?? "national"}`} input={{facility:profile,issue,region:selected,nationalContext:result.nationalContext,mode}} running={running} onGenerated={onProblemGenerated} />
    <section className="national-evidence"><div className="section-heading"><h3>전국 공통 배경 근거</h3><span className="muted">지역별 자동 배분·점수 가산 없음</span></div><GeographicEvidenceList items={result.nationalContext} emptyMessage="전국 범위로 명시된 공통 배경 근거가 없습니다." /></section>
    <details className="unresolved-geography panel"><summary>위치 확인이 필요한 근거 {result.unresolved.length}건</summary>{result.unresolved.map((entry,index)=><p key={index}>{entry.reason} · {entry.evidenceId}</p>)}</details>
  </section>;
}
