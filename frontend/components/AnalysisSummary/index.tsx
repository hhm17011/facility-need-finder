import type { FacilityProfile } from '../../evidenceTypes';
export function AnalysisSummary({ profile }: { profile: FacilityProfile }) {
  const fields = [
    ['시설', profile.facilityName], ['유형', profile.facilityCategory],
    ['핵심 이용자', profile.primaryUsers.join(' / ') || '확인 필요'],
    ['관련 이용자', profile.relatedUsers.join(' / ') || '확인 필요'],
    ['주요 기능', profile.mainFunctions.join(' / ') || '확인 필요'],
    ['관련 문제', profile.problemDomains.join(' / ')],
  ];
  return <section className="interpretation" aria-labelledby="interpretation-title">
    <div className="summary-heading"><h2 id="interpretation-title">시설 해석 결과</h2><span className="small-tag">{profile.interpretationStatus === 'matched' ? '유형 일치 · 초안' : '확인 필요'}</span></div>
    <p className="query-caption">입력: “{profile.originalInput}”</p>
    <dl className="summary-grid profile-grid">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="interpretation-note">{profile.interpretationNote}</p>
  </section>;
}
