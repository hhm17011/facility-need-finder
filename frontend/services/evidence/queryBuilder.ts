import type { EvidenceSearchPlan, EvidenceType, FacilityProfile } from '../../evidenceTypes';
import type { SearchQuery } from './types';
// Search preferences only, never proof of reliability or a whitelist of truth.
export const preferredDomains: Record<EvidenceType, string[]> = {
  LAW_POLICY: ['law.go.kr', 'go.kr'],
  RESEARCH: ['riss.kr', 'kci.go.kr', 'scienceon.kisti.re.kr'],
  PUBLIC_REPORT: ['go.kr', 'nrc.re.kr', 'prism.go.kr'],
  DEMAND_SURVEY: ['go.kr', 're.kr'], SURVEY: ['go.kr', 're.kr', 'ac.kr'],
  STATISTICS: ['kosis.kr', 'data.go.kr', 'go.kr'],
  NEWS: [],
};
export function buildQueries(profile: FacilityProfile, plan: EvidenceSearchPlan, options = { queriesPerCategory: 2, resultsPerQuery: 5 }): SearchQuery[] {
  const limit = Math.max(1, Math.min(3, Math.floor(options.queriesPerCategory) || 2));
  const count = Math.max(1, Math.min(10, Math.floor(options.resultsPerQuery) || 5));
  return plan.evidenceCategories.flatMap(category => {
    const unique = new Map<string, SearchQuery>();
    for (const search of [...category.plannedSearches].sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high'))) {
      const text = search.query.includes(profile.facilityName) ? search.query : `${profile.facilityName} ${search.query}`;
      const query = text.replace(/\s+/g, ' ').trim();
      if (!query) continue;
      unique.set(query, { ...search, category: category.type, query, preferredDomains: preferredDomains[category.type], maxResults: count });
      if (unique.size >= limit) break;
    }
    return [...unique.values()];
  });
}
