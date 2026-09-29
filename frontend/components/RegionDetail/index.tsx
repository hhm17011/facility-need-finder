import {SigunguDetail} from '../SigunguExplorer/Detail';
import { RegionalEvidenceDetail } from '../RegionalEvidence/Detail';
import type { Phenomenon } from '../../services/issues/types';
import { useState } from 'react';
import type { EvidenceType } from '../../evidenceTypes';
import type { RegionEvidenceProfile, CandidateDimension } from '../../services/geography/types';
import { candidateDimensionLabels } from '../../services/geography/config';
import { evidenceTypeLabels, GeographicEvidenceList } from '../GeographicOverview/EvidenceList';
function LegacyRegionDetail({ region, phenomena = [] }: { region: RegionEvidenceProfile; phenomena?: Phenomenon[] }) {
  const [category, setCategory] = useState<EvidenceType | 'all'>('all');
  const filtered = (items: RegionEvidenceProfile['evidenceItems']) => items.filter(item => category === 'all' || item.categories.includes(category));
  const evidenceLink = (id: string) => region.evidenceItems.find(item => item.id === id);
  const stats = [['근거 수', region.metrics.totalEvidence], ['강한 근거', region.metrics.strongEvidence], ['직접 근거', region.metrics.directEvidence], ['출처 기관 수', region.metrics.sourceOrganizations], ['근거 유형 수', region.metrics.evidenceCategories]];
  return <section className="detail-section" aria-labelledby="detail-title">
    <div className="section-heading"><div><span className="section-kicker">REGIONAL ISSUE EVIDENCE</span><h2 id="detail-title">선택 지역 상세</h2></div><span className={`mode-badge ${region.mode}`}>{region.mode === 'demo' ? 'DEMO · 가상 근거' : 'LIVE · 발견 자료'}</span></div>
    <div className="panel geographic-detail-header"><div className="region-identity"><span className="small-tag">{region.rank ? `현재 후보 ${region.rank}위` : '이슈 신호 보류'}</span><h3>{region.region.displayName}</h3><span className="muted">공식 행정코드 미연결 · 최종 부지 선정 아님</span></div><div className="need-score"><span>Issue Signal</span><div><strong>{region.candidateScore?.toFixed(1) ?? '—'}</strong><span> / 100</span></div></div><div className="candidate-confidence"><span>Confidence</span><strong>{region.confidence}</strong><span>자료 충분성의 시제품 판단</span></div></div>
    <dl className="analysis-stats geographic-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {region.warnings.length > 0 && <div className="geographic-warning"><strong>추가 조사 필요</strong><ul>{region.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
    <details className="candidate-calculation panel"><summary>이슈 신호 산정 근거</summary><p>현재 프로토타입에서는 각 평가축을 동일 가중치로 계산합니다. 미평가는 제외합니다. AHP·전문가 검증 점수가 아닙니다.</p>
      {(Object.keys(region.dimensions) as CandidateDimension[]).map(key => <div className="candidate-dimension" key={key}><strong>{candidateDimensionLabels[key]} <span>{region.dimensions[key].score?.toFixed(1) ?? '미평가'}</span></strong><p>{region.dimensions[key].reason}</p><div className="score-source-links">{region.dimensions[key].evidenceIds.map(id => { const item = evidenceLink(id)!; return item.url && item.mode === 'live' ? <a href={item.url} key={id} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : <span key={id}>DEMO: {item.title}</span>; })}</div></div>)}
      <p className="strength-formula">{region.calculation.included.map(key => `${candidateDimensionLabels[key]} ${region.dimensions[key].score?.toFixed(1)} × ${region.calculation.weights[key]}`).join(' + ')}<br />정밀 합계 {region.calculation.weightedSum.toFixed(3)} ÷ 가중치 합 {region.calculation.weightSum} → {region.candidateScore === null ? '자료 충분성 미달로 점수 보류' : region.candidateScore.toFixed(1)}</p>
      <p>대표 자료 {region.calculation.evidenceIds.length}개 / 보존 자료 {region.metrics.totalEvidence}개. 동일 기관·도메인·동일 제목 묶음에서 1개, 같은 주 유형에서 최대 2개만 점수에 기여합니다. 제외된 자료도 아래에 보존합니다.</p>
      <h4>Confidence 산정</h4><ul>{region.confidenceReasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p>상반된 근거는 점수에서 일괄 차감하지 않습니다. 강한 수요 약화 근거가 있으면 확신도를 낮추며, 미판정은 ‘반대 근거 없음’이 아닙니다.</p>
    </details>
    <div className="evidence-heading"><h3>이 지역에서 어떤 현상이 나타나는가?</h3><span className="muted">메타데이터 기반 연결 이유 · 사실 결론 생성 없음</span></div>
    <div className="regional-phenomena">{phenomena.map(p => <blockquote key={p.id}>{p.title}<small> · {p.status} · 근거 {p.evidenceIds.length}개</small></blockquote>)}</div><div className="region-why-list">{region.why.map((reason, index) => <article key={reason.evidenceIds.join('|')}><span className="section-kicker">0{index + 1} / 지명과 자료 연결</span><p>{reason.text}</p><details><summary>지역 연결 원문 확인</summary><blockquote>{reason.quote}</blockquote></details>{reason.evidenceIds.map(id => { const item = evidenceLink(id)!; return item.url && item.mode === 'live' ? <a key={id} href={item.url} target="_blank" rel="noopener noreferrer">근거 원문 보기 ↗</a> : <span key={id} className="mock-label">DEMO · 원문 없음</span>; })}</article>)}</div>
    <div className="region-category-controls"><label htmlFor="region-evidence-category">지역 근거 유형</label><select id="region-evidence-category" value={category} onChange={event => setCategory(event.target.value as EvidenceType | 'all')}><option value="all">전체</option>{Object.entries(evidenceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>아래 자료만 필터링하며 이슈 신호는 바뀌지 않습니다.</span></div>
    <section className="region-evidence-group conflict"><h3>반대 또는 주의가 필요한 근거 <span>{filtered(region.weakensNeed).length}</span></h3><GeographicEvidenceList items={filtered(region.weakensNeed)} emptyMessage="현재 필터에서 수요 약화로 판정된 자료가 없습니다. 반대 근거가 없다는 결론은 아닙니다." /></section>
    <section className="region-evidence-group support"><h3>수요 지지로 판정된 근거 <span>{filtered(region.supportsNeed).length}</span></h3><GeographicEvidenceList items={filtered(region.supportsNeed)} emptyMessage="현재 필터에서 수요 지지로 판정된 자료가 없습니다." /></section>
    <section className="region-evidence-group"><h3>배경 근거 <span>{filtered(region.context).length}</span></h3><GeographicEvidenceList items={filtered(region.context)} /></section>
    <section className="region-evidence-group unknown"><h3>직접성·수요 방향 확인이 필요한 근거 <span>{filtered(region.unknown).length}</span></h3><GeographicEvidenceList items={filtered(region.unknown)} /></section>
  </section>;
}

export function RegionDetail(props:{region:RegionEvidenceProfile;phenomena?:Phenomenon[]}) { return props.region.demographicMetrics ? <SigunguDetail region={props.region}/> : props.region.regionalAssessment ? <RegionalEvidenceDetail region={props.region}/> : <LegacyRegionDetail {...props}/>; }
