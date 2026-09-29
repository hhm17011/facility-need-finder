import { useState } from 'react';
import type { FacilityProfile, EvidenceSearchPlan } from './evidenceTypes';
import { interpretFacility } from './services/interpretFacility';
import { planEvidenceSearch } from './services/planEvidenceSearch';
import { FacilityInput } from './components/FacilityInput';
import { AnalysisSummary } from './components/AnalysisSummary';
import { EvidencePlan } from './components/EvidencePlan';
import { EvidenceExplorer } from './components/EvidenceExplorer';
import { AnalysisPipeline } from './components/AnalysisPipeline';
import {ProfessorResult} from './components/ProfessorResult';
export default function App() {
  const [result, setResult] = useState<{ profile: FacilityProfile; plan: EvidenceSearchPlan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState(0);
  const [issueStatus, setIssueStatus] = useState({relationships:'근거 탐색 후 대기',issues:'관계 검토 후 대기',problem:'이슈 선택 대기'});
  const [error, setError] = useState('');
  const [geographyStatus, setGeographyStatus] = useState({ mapping: '근거 평가 후 대기', candidates: '지역 연결 후 대기' });
  const [analysisStatus, setAnalysisStatus] = useState('탐색 후 평가 대기');
  const [discoveryStatus, setDiscoveryStatus] = useState('계획 완료 · 탐색 대기');
  async function analyze(input: string) {
    if (busy) return;
    setBusy(true); setError(''); setIssueStatus({relationships:'근거 탐색 후 대기',issues:'관계 검토 후 대기',problem:'이슈 선택 대기'}); setResult(null); setRun(value => value + 1); setDiscoveryStatus('계획 완료 · 탐색 대기'); setAnalysisStatus('탐색 후 평가 대기'); setGeographyStatus({ mapping: '근거 평가 후 대기', candidates: '지역 연결 후 대기' });
    try {
      const profile = await interpretFacility(input);
      const plan = planEvidenceSearch(profile);
      setResult({ profile, plan });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '탐색 계획을 만들지 못했습니다. 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }
  return <>
    <header className="site-header"><div className="header-inner"><div className="brand"><span className="brand-mark" aria-hidden="true">F<span>·</span></span><div><h1>Architectural Issue Explorer</h1><p>시설 뒤에 숨은 현상과 공간적 질문을 탐색합니다.</p></div></div><div className="header-meta"><span className="status-dot" /> EVIDENCE EXPLORER <span className="version">V 0.6</span></div></div></header>
    <main>
      <div className="page-intro"><span>AI 기반 건축 이슈 분석기</span><span>PHENOMENA / RELATIONSHIPS / ISSUES</span></div>
      <FacilityInput onAnalyze={analyze} busy={busy} />
      <div role="status" className="status-message">{busy ? '시설을 이해하고 있습니다…' : ''}</div>
      {error && <p role="alert" className="error">{error}</p>}
      {!result && !busy && <section className="empty-state"><span className="empty-symbol" aria-hidden="true">⌖</span><span className="section-kicker">FROM A QUESTION TO EVIDENCE</span><h2>설계하고 싶은 시설에서<br />건축적 이슈를 발견해보세요.</h2><p>사회·인구·도시·공간의 변화를 탐색하고,<br />현상 간 관계에서 건축적으로 다룰 수 있는 질문을 찾습니다.</p><div className="empty-steps"><span>01 시설 이해</span><span aria-hidden="true">→</span><span>02 탐색 질문 구성</span><span aria-hidden="true">→</span><span>03 근거 수집 준비</span></div><p className="empty-note">로컬 규칙으로 시설을 해석합니다. 계획 생성 후 DEMO 또는 API 기반 LIVE 탐색을 선택할 수 있습니다.</p></section>}
      {result && <div aria-busy={busy}><ProfessorResult key={`result:${run}`} profile={result.profile} plan={result.plan}/><details className="advanced-analysis"><summary>상세 분석 보기</summary><div className="research-trail"><h3>분석 과정</h3><p>시설 이해 ↓ 9개 관점에서 현상 탐색 ↓ 실제 근거 탐색 ↓ 근거 관계 분석 ↓ 건축 이슈 도출 ↓ 지역 근거 검증</p></div><AnalysisPipeline issueStatus={issueStatus} geographyStatus={geographyStatus} analysisStatus={analysisStatus} discoveryStatus={discoveryStatus} planned needsClarification={result.profile.interpretationStatus === 'needs_clarification'} /><AnalysisSummary profile={result.profile} /><EvidencePlan plan={result.plan} /><EvidenceExplorer onIssueStatus={setIssueStatus} key={run} profile={result.profile} plan={result.plan} onStatus={setDiscoveryStatus} onAnalysisStatus={setAnalysisStatus} onGeographyStatus={setGeographyStatus} /></details></div>}
    </main>
    <footer className="site-footer"><span>ARCHITECTURAL ISSUE EXPLORER</span><span>건축을 위한 질문, 근거로 찾는 시작점.</span><span>PROTOTYPE / 06</span></footer>
  </>;
}
