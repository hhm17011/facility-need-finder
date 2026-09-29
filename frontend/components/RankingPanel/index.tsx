import { useEffect, useRef } from 'react';
import type { RegionEvidenceProfile } from '../../services/geography/types';
interface Props { regions: RegionEvidenceProfile[]; selectedCode: string; onSelect: (code: string) => void }
export function RankingPanel({ regions, selectedCode, onSelect }: Props) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = list.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (button && list.current) {
      const top = button.offsetTop;
      if (top < list.current.scrollTop || top + button.offsetHeight > list.current.scrollTop + list.current.clientHeight) list.current.scrollTop = top;
    }
  }, [selectedCode]);
  return <section className="panel ranking-panel" aria-labelledby="ranking-title">
    <div className="panel-header"><div><span className="section-kicker">REGIONAL EVIDENCE</span><h3 id="ranking-title">관련 지역 {regions.length}개</h3></div><span className="small-tag">직접 근거 확인</span></div>
    <div className="ranking-columns"><span>표시 순서</span><span>지역명</span><span>Issue Signal</span></div>
    <div className="ranking-list" ref={list}>
      {regions.map((region) => <button type="button" className={`ranking-row ${selectedCode === region.region.id ? 'selected' : ''}`} key={region.region.id} aria-pressed={selectedCode === region.region.id} onClick={() => onSelect(region.region.id!)}>
        <span className="rank">{String(region.rank).padStart(2, '0')}</span><span className="region-name">{region.region.displayName}<small className="candidate-row-meta">{region.regionalAssessment?.status ?? region.confidence} · 근거 범위 {region.regionalAssessment?.coverageCount ?? '—'}/{region.regionalAssessment?.coverageTotal ?? '—'}</small><span className="row-bar" style={{ width: `${region.candidateScore}%` }} /></span><strong>{region.candidateScore?.toFixed(1)}</strong>
      </button>)}
      {!regions.length && <p className="no-evidence">표시할 후보가 없습니다.</p>}
    </div><div className="ranking-footer">동일 가중 시제품 점수 · 최적 부지 순위가 아닙니다.</div>
  </section>;
}
