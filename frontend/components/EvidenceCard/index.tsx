import type { Evidence } from '../../types';
export function EvidenceCard({ evidence, index, categoryLabel }: { evidence: Evidence; index: number; categoryLabel: string }) {
  return <article className="evidence-card">
    <div className="evidence-top"><span>{String(index + 1).padStart(2, '0')} / {categoryLabel}</span>{evidence.isMock && <span className="mock-label">MOCK</span>}</div>
    <h4>{evidence.title}</h4><p>{evidence.statement}</p>
    <div className="evidence-value">{evidence.value}</div><div className="comparison">{evidence.comparison}</div>
    <dl className="evidence-source"><div><dt>출처</dt><dd>{evidence.source}</dd></div><div><dt>기준연도</dt><dd>{evidence.referenceYear}</dd></div></dl>
  </article>;
}
