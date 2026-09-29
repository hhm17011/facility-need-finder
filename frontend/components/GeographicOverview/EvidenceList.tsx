import type { EvaluatedEvidenceItem } from '../../services/evidence/analysis/types';
import type { EvidenceType } from '../../evidenceTypes';
export const evidenceTypeLabels: Record<EvidenceType, string> = { LAW_POLICY: '법령·정책', RESEARCH: '연구·논문', PUBLIC_REPORT: '공공보고서', DEMAND_SURVEY: '수요조사', SURVEY: '설문', STATISTICS: '통계', NEWS: '기사' };
export function GeographicEvidenceList({ items, emptyMessage = '해당하는 근거가 없습니다.' }: { items: EvaluatedEvidenceItem[]; emptyMessage?: string }) {
  return items.length ? <div className="geographic-evidence-list">{items.map(item => <article className="geographic-evidence-card" key={item.id}>
    <div className="discovery-card-top"><span>{item.categories.map(type => evidenceTypeLabels[type]).join(' / ')}</span><span className={`mode-badge ${item.mode}`}>{item.mode === 'demo' ? 'DEMO · 가상 자료' : 'LIVE'}</span></div>
    <h4>{item.title}</h4><p>{item.snippet || '제공된 스니펫 없음'}</p>
    <div className="geo-source-meta">출처: {item.sourceOrganization || item.sourceLabel || '기관 미확인'} · 발행일: {item.publishedDate || '미확인'}</div>
    <div className="geo-source-meta">근거 강도 {item.evidenceStrength?.toFixed(1) ?? '미평가'} · 평가 {item.evaluationCompleteness.available}/{item.evaluationCompleteness.total} · {item.evidenceRole} · {item.stance}</div>
    <details><summary>근거 강도 설명</summary><p>평가 가능한 항목의 가중 평균입니다. 메타데이터 평가이며 원문 검증 결과가 아닙니다.</p>{Object.entries(item.evaluation).map(([key, value]) => <p key={key}>{key}: {value.score ?? '미평가'} — {value.reason}</p>)}</details>
    {item.url && item.mode === 'live' ? <a href={item.url} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a> : <span className="muted">DEMO · 원문 없음</span>}
  </article>)}</div> : <p className="geographic-empty">{emptyMessage}</p>;
}
