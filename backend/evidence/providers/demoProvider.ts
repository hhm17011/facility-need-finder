import { EvidenceType } from '../../../frontend/evidenceTypes';
import type { SearchProvider } from '../../../frontend/services/evidence/types';
export function createDemoProvider(): SearchProvider {
  return {
    id: 'demo-fixture', mode: 'demo', categories: Object.values(EvidenceType), configured: true,
    async search(query, signal) {
      signal.throwIfAborted();
      // Intentionally no real-looking titles, organizations, dates, statistics or URLs.
      return [{ demoId: query.category, title: `[DEMO · 가상 자료] ${query.category} 카드 표시 예시`,
        url: null, snippet: `[실제 자료 아님] 검색어 “${query.query}”의 결과 표시를 시연합니다. 용인시에서 이용자 인구의 이동을 가정합니다. 용인시에서 기존 시설 분포가 유지되지만 생활권과 불일치하는 상황을 가정합니다. 광주광역시는 지역 필터 예시입니다. 모든 지명과 현상은 가상 시나리오이며 실제 지역에 대한 주장이 아닙니다.`,
        sourceOrganization: null, sourceLabel: 'DEMO · 가상 출처', publishedDate: null,
        retrievedAt: new Date().toISOString(), provider: 'demo-fixture', mode: 'demo' }];
    },
  };
}
