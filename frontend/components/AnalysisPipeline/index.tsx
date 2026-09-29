export function AnalysisPipeline({ planned, needsClarification, discoveryStatus, analysisStatus, geographyStatus, issueStatus }: { issueStatus: {relationships:string;issues:string;problem:string}; planned: boolean; needsClarification: boolean; discoveryStatus: string; analysisStatus: string; geographyStatus: { mapping: string; candidates: string } }) {
  const steps = [
    { label: '시설 이해', status: planned ? (needsClarification ? '처리 완료 · 확인 필요' : '완료 · 로컬 규칙') : '입력 대기', complete: planned },
    { label: '현상 탐색', status: planned ? discoveryStatus : '시설 해석 후 탐색 가능', complete: false },
    { label: '근거 분석', status: analysisStatus, complete: analysisStatus.includes('완료') },
    { label: '관계 분석', status: issueStatus.relationships, complete: issueStatus.relationships.includes('완료') },
    { label: '건축 이슈', status: issueStatus.issues, complete: issueStatus.issues.includes('선택됨') },
    { label: '지역 근거 탐색', status: geographyStatus.mapping, complete: geographyStatus.mapping.includes('완료') },
    { label: '지역 비교', status: geographyStatus.candidates, complete: geographyStatus.candidates.includes('완료') },
    { label: '지도', status: geographyStatus.candidates.includes('완료') ? '검증 지역 연결 완료' : '지역 근거 검증 후 표시', complete: geographyStatus.candidates.includes('완료') },
    { label: '문제 정의', status: issueStatus.problem, complete: issueStatus.problem.includes('완료') },
  ];
  return <nav aria-label="분석 진행 단계" className="pipeline"><ol>{steps.map((step, index) => <li key={step.label} className={step.complete ? 'complete' : index === 1 && planned ? 'planned' : ''}>
    <span className="pipeline-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><span>{step.status}</span></div>
  </li>)}</ol></nav>;
}
