import { EvidenceType } from '../../../frontend/evidenceTypes';
import type { RawSearchResult, SearchProvider, SearchQuery } from '../../../frontend/services/evidence/types';
export class ProviderError extends Error {
  constructor(public code: 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'INVALID_RESPONSE', public retryAfterMs = 0) { super(code); }
}
export function providerQuery(query: SearchQuery): string {
  const scope = query.preferredDomains.length ? ` (${query.preferredDomains.map(domain => `site:${domain}`).join(' OR ')})` : '';
  const budget = 590 - scope.length;
  return `${query.query.slice(0, budget).split(/\s+/).slice(0, 60).join(' ')}${scope}`;
}
export function createWebSearchProvider(apiKey: string, fetcher: typeof fetch = fetch): SearchProvider {
  let blockedUntil = 0;
  return {
    id: 'brave-web', mode: 'live', categories: Object.values(EvidenceType), configured: !!apiKey.trim(),
    async search(query, signal) {
      if (!apiKey.trim()) throw new ProviderError('AUTH');
      if (Date.now() < blockedUntil) throw new ProviderError('RATE_LIMIT');
      const endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
      endpoint.search = new URLSearchParams({ q: providerQuery(query), country: 'KR', search_lang: 'ko', count: String(query.maxResults), result_filter: 'web', text_decorations: 'false', spellcheck: 'false' }).toString();
      const response = await fetcher(endpoint, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey }, signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { blockedUntil = Date.now() + 60000; throw new ProviderError('AUTH'); }
        if (response.status === 429) { blockedUntil = Date.now() + 60000; throw new ProviderError('RATE_LIMIT', 60000); }
        throw new ProviderError('NETWORK');
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('type' in payload) || payload.type !== 'search') throw new ProviderError('INVALID_RESPONSE');
      const web = 'web' in payload ? payload.web : undefined;
      if (web == null) return [];
      if (typeof web !== 'object' || !('results' in web) || !Array.isArray(web.results)) throw new ProviderError('INVALID_RESPONSE');
      const retrievedAt = new Date().toISOString();
      return web.results.slice(0, query.maxResults).flatMap((item: unknown): RawSearchResult[] => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        if (typeof row.title !== 'string' || typeof row.url !== 'string') return [];
        const profile = row.profile as { name?: unknown } | undefined;
        return [{ title: row.title, url: row.url, snippet: typeof row.description === 'string' ? row.description : '',
          sourceOrganization: null, sourceLabel: typeof profile?.name === 'string' ? profile.name : null,
          // Brave page_age may be a last-modified date. Never call it publication date.
          publishedDate: null, providerDateHint: typeof row.page_age === 'string' ? row.page_age : null,
          retrievedAt, provider: 'brave-web', mode: 'live', retrievalStatus: 'SEARCH_RESULT_ONLY', authors: [] }];
      });
    },
  };
}
