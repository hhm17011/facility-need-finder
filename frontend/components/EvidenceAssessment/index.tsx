import { dimensionLabels, dimensions, evaluationConfig } from '../../services/evidence/analysis/config';
import type { EvaluatedEvidenceItem } from '../../services/evidence/analysis/types';
import type { summarizeAnalysis } from '../../services/evidence/analysis/selection';
const roleLabels = { DIRECT: '직접 근거', CONTEXT: '맥락 자료', UNKNOWN: '직접성 미판정' };
const stanceLabels = { SUPPORTS_NEED: '수요 지지', WEAKENS_NEED: '수요 약화', NEUTRAL: '중립', UNKNOWN: '수요 방향 미판정' };
export function EvidenceAssessment({ item }: { item: EvaluatedEvidenceItem }) {
  const calculation = item.strengthCalculation;
  return <div className="evidence-assessment">
    <div className="strength-overview"><div><span>{item.mode === 'demo' ? 'DEMO 근거 강도' : '근거 강도'}</span><strong>{item.evidenceStrength === null ? '평가 불가' : item.evidenceStrength.toFixed(1)}{item.evidenceStrength !== null && <small> / 100</small>}</strong></div><div className="strength-status"><span className="small-tag">{item.strengthLabel}</span><span>평가 {item.evaluationCompleteness.available} / {item.evaluationCompleteness.total}항목</span></div></div>
    <p className="assessment-caption">메타데이터만 평가 · {calculation.method === 'equal_available_mean' ? '확인 가능한 항목의 동일 가중 평균' : '설정된 가중 평균'} · 검증되지 않은 시제품 기준</p>
    <div className="evidence-role"><span>{roleLabels[item.evidenceRole]}</span><span>{stanceLabels[item.stance]}</span></div>
    <details className="evaluation-details"><summary>평가 근거 보기</summary>
      <p className="evaluation-limit">제목·검색 스니펫·출처 메타데이터에 한정한 평가입니다. 원문 전문, 기관 진위, 동료심사, 수치 정확성을 검증하지 않았습니다.{item.mode === 'demo' && ' 이 평가는 가상 자료의 동작 예시이며 실제 근거 평가가 아닙니다.'}</p>
      <dl>{dimensions.map(key => { const assessment = item.evaluation[key]; return <div className="dimension-assessment" key={key}><dt>{dimensionLabels[key]}<strong>{assessment.score === null ? '미평가' : `${assessment.score} / 100`}</strong></dt><dd>{assessment.reason}{assessment.signals.length > 0 && <ul>{assessment.signals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}</dd></div>; })}</dl>
      <div className="strength-formula"><strong>근거 강도 계산</strong><p>{calculation.included.length ? `${calculation.included.map(key => `${dimensionLabels[key]} ${item.evaluation[key].score} × ${calculation.weights[key]}`).join(' + ')} = ${calculation.weightedSum}` : '평균에 포함할 수 있는 항목이 없습니다.'}</p><p>{calculation.weightSum ? `${calculation.weightedSum} ÷ ${calculation.weightSum} = ${item.evidenceStrength?.toFixed(1)} (소수점 첫째 자리 반올림)` : '유효한 가중치 합이 0이므로 종합 점수는 미평가입니다.'}</p><p>미평가 항목: {calculation.missing.map(key => dimensionLabels[key]).join(' / ') || '없음'} · 미평가를 0점으로 대체하지 않습니다.</p>{calculation.excludedByWeight.length > 0 && <p>가중치 0으로 제외: {calculation.excludedByWeight.map(key => dimensionLabels[key]).join(' / ')}</p>}</div>
      <p className="evaluation-limit">{item.roleReason} {item.stanceReason}</p>
      <p className="evaluation-limit">관찰된 입력 관련 표현: {item.matchingTerms.join(' / ') || '없음'}. 단어 일치는 관련성 점수가 아닙니다.</p>
      <p className="evaluation-limit">평가 기준일 {item.analyzedAt.slice(0, 10)} · {item.analysisVersion}</p>
    </details>
  </div>;
}
export function EvidenceAnalysisSummary({ summary, top, mode, running }: { summary: ReturnType<typeof summarizeAnalysis>; top: EvaluatedEvidenceItem[]; mode: 'demo' | 'live'; running: boolean }) {
  const stats = [['총 근거', summary.total], ['강한 근거', summary.strong], ['직접 지역 근거', summary.directRegional], ['맥락 자료', summary.contextual], ['평가 정보 부족', summary.insufficient], ['직접성 미판정', summary.unresolvedRole]];
  return <section className="analysis-summary" aria-labelledby="analysis-summary-title"><div className="section-heading"><div><span className="section-kicker">04 / EVIDENCE ANALYSIS</span><h3 id="analysis-summary-title">{mode === 'demo' ? 'DEMO 탐색 결과 분석' : '탐색 결과 분석'}</h3></div><span className="small-tag">{running ? '도착한 자료부터 평가 중' : '메타데이터 평가'} · 의미 분석 미연결</span></div>
    <dl className="analysis-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="discovery-note">전체 탐색 자료 기준입니다. 근거 강도는 평가 가능한 항목만 평균 내며, 평가 정보가 적으면 비교에 주의가 필요합니다. 직접성·수요 방향은 의미 분석 전까지 미판정으로 남습니다. 반대·수요 감소 자료도 삭제하지 않습니다.</p>
    <div className="top-evidence"><h3>검토 우선 근거 <span>Top Evidence</span></h3><p>현재 필터 기준 · {evaluationConfig.top.minimumScore}점 이상, {evaluationConfig.top.minimumDimensions}개 이상 항목이 평가된 자료 중 최대 {evaluationConfig.top.limit}개입니다. 유사한 강도에서는 유형 다양성을 고려합니다. 시설의 필요성을 입증했다는 뜻은 아닙니다.</p>
      {top.length ? <ol>{top.map(item => <li key={item.id}><div>{item.mode === 'demo' && <span className="mock-label">DEMO 평가</span>}{item.url && item.mode === 'live' ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : <span>{item.title}</span>}<small>{roleLabels[item.evidenceRole]} · {stanceLabels[item.stance]} · 평가 {item.evaluationCompleteness.available}/{item.evaluationCompleteness.total}</small></div><strong>{item.evidenceStrength?.toFixed(1)}</strong></li>)}</ol> : <div className="top-empty">선정 기준을 충족한 근거가 없습니다. 부족한 정보나 약한 자료로 목록을 채우지 않습니다.</div>}
    </div>
  </section>;
}
