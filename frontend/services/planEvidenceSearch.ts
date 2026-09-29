import { explorePhenomena } from './issues/explorationTopics';
import { EvidenceType, type EvidenceSearchPlanner, type FacilityProfile, type SourceType } from '../evidenceTypes';
interface Strategy {
  type: EvidenceType;
  label: string;
  sources: SourceType[];
  purpose: (p: FacilityProfile) => string;
  topics: (p: FacilityProfile) => string[];
}
const audience = (p: FacilityProfile) => p.primaryUsers.join('·') || '잠재 이용자';
const activity = (p: FacilityProfile) => p.mainFunctions[0] || p.facilityName;
const strategies: Strategy[] = [
  { type: EvidenceType.LAW_POLICY, label: '법령·정책', sources: ['official_law', 'government_policy'],
    purpose: p => `${p.facilityName}의 설치·운영 기준과 관련 정책을 확인하고 제도적 필요성을 검토합니다.`,
    topics: p => [`${p.facilityName} 설치 기준 관련 법령`, `${p.facilityCategory === '분류 확인 필요' ? p.facilityName : p.facilityCategory} 지원 정책`, `${activity(p)} 인프라 확충 계획`] },
  { type: EvidenceType.RESEARCH, label: '연구·논문', sources: ['academic_paper'],
    purpose: p => `${p.facilityName}의 수요·접근성·입지에 관한 선행 연구와 연구의 한계를 살펴봅니다.`,
    topics: p => [`${p.facilityName} 입지 연구`, `${p.facilityName} ${p.problemDomains[0] || '접근성'} 연구`, `${p.facilityName} 지역 격차 논문`] },
  { type: EvidenceType.PUBLIC_REPORT, label: '공공 보고서', sources: ['public_institution_report'],
    purpose: p => `공공기관이 진단한 ${p.facilityName} 현황, 생활권 과제와 중장기 공급 계획을 확인합니다.`,
    topics: p => [`${p.facilityName} 지역 현황 공공기관 보고서`, `${activity(p)} 인프라 중장기 계획 보고서`] },
  { type: EvidenceType.DEMAND_SURVEY, label: '수요조사', sources: ['demand_survey', 'public_institution_report'],
    purpose: p => `${audience(p)}와 지역사회에 실제로 어떤 ${activity(p)} 수요가 있는지 조사 대상·시점과 함께 확인합니다.`,
    topics: p => [`${p.facilityName} 지역별 수요조사`, `${audience(p)} ${activity(p)} 이용 의향 미이용 이유 조사`] },
  { type: EvidenceType.SURVEY, label: '설문', sources: ['user_survey'],
    purpose: p => `${p.facilityName} 이용자의 요구·불편·만족도를 표본과 질문 구성을 고려해 확인합니다.`,
    topics: p => [`${p.facilityName} 이용자 만족도 설문`, `${audience(p)} ${p.facilityName} 이용 불편 설문`] },
  { type: EvidenceType.STATISTICS, label: '통계', sources: ['official_statistics'],
    purpose: p => `${audience(p)} 규모와 ${p.facilityName} 공급·이용 현황을 기준연도와 지역 단위별로 확인합니다.`,
    topics: p => [`${audience(p)} 지역별 인구 통계`, `${p.facilityName} 지역별 시설 수`, `${p.facilityName} 이용 현황 통계`] },
  { type: EvidenceType.NEWS, label: '기사', sources: ['news_article'],
    purpose: p => `${p.facilityName}의 최근 지역 현안과 수요 변화의 단서를 찾고 원자료로 교차 확인할 사항을 정리합니다.`,
    topics: p => [`${p.facilityName} 지역별 수요 변화`, `${p.facilityName} 이용 감소 유휴 시설`, `${p.facilityName} 공급 충분 부족 현황`] },
];
/** Planning only: query strings are hypotheses to investigate, never retrieved claims. */
export const planEvidenceSearch: EvidenceSearchPlanner = (profile) => ({
  facility: profile.facilityName,
  phenomenonTopics: explorePhenomena(profile),
  geographicScope: '대한민국',
  status: 'planned',
  requiresClarification: profile.interpretationStatus !== 'matched',
  evidenceCategories: strategies.map((strategy) => {
    const purpose = strategy.purpose(profile);
    const families: Record<EvidenceType, string[]> = {
      LAW_POLICY: ['POLICY'], RESEARCH: ['SPATIAL', 'SOCIAL'], PUBLIC_REPORT: ['URBAN', 'ENVIRONMENTAL'],
      DEMAND_SURVEY: ['USER'], SURVEY: ['USER', 'ECONOMIC'], STATISTICS: ['DEMOGRAPHIC', 'FACILITY'], NEWS: ['FACILITY', 'SOCIAL'],
    };
    const topics = explorePhenomena(profile).filter(topic => families[strategy.type].includes(topic.category));
    // Alternate families before second queries so the existing per-type cap retains breadth.
    const expanded=[...(profile.relatedFacilityTerms??[]),...(profile.demandConcepts??[]),...(profile.supplyConcepts??[]),...(profile.spatialConcepts??[]),...(profile.policyConcepts??[])].map(term=>`${profile.facilityName} ${term}`);
    const searchTopics = [...new Set([...topics.map(topic => topic.queries[0]),...topics.flatMap(topic=>topic.queries.slice(1)),...strategy.topics(profile),...expanded])].slice(0,8);
    return {
      type: strategy.type, label: strategy.label, purpose, searchTopics,
      plannedSearches: searchTopics.map(query => ({
        category: strategy.type, query, purpose, priority: 'normal',
        geographicScope: '대한민국', preferredSourceTypes: [...strategy.sources],
      })),
    };
  }),
});
