import type { EvidenceSearchPlan } from '../../evidenceTypes';
export function EvidencePlan({ plan }: { plan: EvidenceSearchPlan }) {
  return <section aria-labelledby="plan-title">
    <div className="section-heading"><div><span className="section-kicker">02 / PHENOMENON EXPLORATION</span><h2 id="plan-title">탐색할 현상</h2></div><span className="small-tag">{plan.requiresClarification ? '확인 전 임시 계획' : '탐색 계획 완료'} · 검색 전략</span></div>
    <p className="plan-description">{plan.facility}와 관련된 변화를 탐색하는 질문입니다. 아래 검색 주제는 실제 자료나 확인된 사실이 아닙니다.</p>
    <div className="plan-grid">{plan.phenomenonTopics?.map(topic => <article className="plan-card" key={topic.id}><span className="section-kicker">{topic.category}</span><h3>{topic.question}</h3><ul>{topic.queries.map(query => <li key={query}>{query}</li>)}</ul><span className="muted">탐색 질문 · 확인된 현상 아님</span></article>)}</div><details><summary>자료 유형별 검색 전략 · 현상을 확인할 출처</summary><div className="plan-grid">{plan.evidenceCategories.map((category, index) => <article className="plan-card" key={category.type}>
      <span className="section-kicker">{String(index + 1).padStart(2, '0')} / {category.type}</span>
      <h3>{category.label}</h3><p>{category.purpose}</p>
      <h4>예정 검색 주제</h4><ul>{category.searchTopics.map(topic => <li key={topic}>{topic}</li>)}</ul>
      <div className="plan-card-footer">탐색 범위: {plan.geographicScope} <span>계획</span></div>
    </article>)}</div></details>
    <aside className="mock-disclaimer"><strong>PLAN ONLY</strong><span>아래 근거 탐색 영역에서 DEMO 또는 LIVE 검색을 시작하세요. 이 계획 자체는 수집된 근거나 지역별 결론이 아닙니다.</span></aside>
  </section>;
}
