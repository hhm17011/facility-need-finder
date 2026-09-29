import type { EvidenceType } from '../../frontend/evidenceTypes';
import { deduplicateEvidence, normalizeEvidence } from '../../frontend/services/evidence/evidenceNormalizer';
import type { CategorySearchResult, RawSearchResult, SearchProvider, SearchQuery } from '../../frontend/services/evidence/types';
import { ProviderError } from './providers/webSearchProvider';
export interface SearchCache {
  get(key: string): RawSearchResult[] | undefined;
  set(key: string, value: RawSearchResult[]): void;
}
export class MemorySearchCache implements SearchCache {
  private entries = new Map<string, { until: number; items: RawSearchResult[] }>();
  constructor(private ttlMs = 300000, private capacity = 200) {}
  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.until <= Date.now()) { this.entries.delete(key); return undefined; }
    return structuredClone(entry.items);
  }
  set(key: string, value: RawSearchResult[]) {
    if (this.ttlMs <= 0) return;
    this.entries.delete(key);
    while (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { until: Date.now() + this.ttlMs, items: structuredClone(value) });
  }
}
/** A single shared queue per local server; includes concurrent browser tabs. */
export class SearchOrchestrator {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private lastRequestAt = 0;
  constructor(private providers: SearchProvider[], private cache: SearchCache = new MemorySearchCache(), private intervalMs = 1100) {}
  private async execute(provider: SearchProvider, query: SearchQuery, signal: AbortSignal) {
    if (this.pending >= 30) throw new ProviderError('RATE_LIMIT');
    this.pending++;
    const task = this.queue.then(async () => {
      signal.throwIfAborted();
      const key = JSON.stringify([provider.id, provider.mode, query.query, query.preferredDomains, query.maxResults]);
      const cached = this.cache.get(key);
      if (cached) return { rows: cached, cached: true };
      if (provider.mode === 'live') {
        const wait = Math.max(0, this.lastRequestAt + this.intervalMs - Date.now());
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        signal.throwIfAborted(); this.lastRequestAt = Date.now();
      }
      const rows = await provider.search(query, signal);
      signal.throwIfAborted(); this.cache.set(key, rows);
      return { rows, cached: false };
    });
    this.queue = task.catch(() => undefined);
    try { return await task; } finally { this.pending--; }
  }
  async searchCategory(category: EvidenceType, queries: SearchQuery[], signal: AbortSignal): Promise<CategorySearchResult> {
    const available = this.providers.filter(provider => provider.configured && provider.categories.includes(category));
    const relevant=this.providers.filter(provider=>provider.categories.includes(category));
    const providerStats:NonNullable<CategorySearchResult['providerStats']>=relevant.filter(provider=>!provider.configured).map(provider=>({provider:provider.id,status:'NOT_CONFIGURED',attemptedQueries:0,resultCount:0}));
    if (!available.length) return { category, status: 'unconfigured', items: [], message: '검색 API가 설정되지 않았습니다.', cachedQueries: 0,providerStats };
    const items = []; let failures = 0; let successes = 0; let cachedQueries = 0;
    for (const provider of available) {
      let providerFailures=0,providerSuccesses=0,providerResults=0;const providerQueries=queries.filter(query => query.category === category).slice(0,provider.maxQueriesPerSearch??queries.length);
      for (const query of providerQueries) {
        signal.throwIfAborted();
        try {
          const response = await this.execute(provider, query, signal);
          successes++;providerSuccesses++;providerResults+=response.rows.length; if (response.cached) cachedQueries++;
          for (const raw of response.rows) {
            if (raw.mode !== provider.mode) continue;
            const item = normalizeEvidence(raw, query); if (item) items.push(item);
          }
        } catch (error) {
          if (signal.aborted) throw error;
          failures++;providerFailures++;
          // No raw errors, request headers, URLs, bodies or keys in logs.
          console.warn('[evidence-search]', { provider: provider.id, category, code: error instanceof ProviderError ? error.code : 'CONNECTION_FAILED' });
          if (error instanceof ProviderError && ['AUTH', 'RATE_LIMIT'].includes(error.code)) break;
        }
      }
      providerStats.push({provider:provider.id,status:providerFailures?(providerSuccesses?'PARTIAL':'FAILED'):'COMPLETE',attemptedQueries:providerSuccesses+providerFailures,resultCount:providerResults});
    }
    return { category, status: failures ? successes ? 'partial' : 'error' : 'complete', items: deduplicateEvidence(items),
      message: failures ? '검색 중 일부 소스에 연결하지 못했습니다. API 설정·사용 한도·네트워크를 확인해 주세요.' : null, cachedQueries,providerStats };
  }
}
