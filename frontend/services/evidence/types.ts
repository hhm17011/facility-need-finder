import type { EvidenceItem, EvidenceType, PlannedSearch } from '../../evidenceTypes';
export type SearchMode = 'demo' | 'live';
export type SearchStatus = 'waiting' | 'searching' | 'complete' | 'partial' | 'error' | 'unconfigured' | 'cancelled';
export interface SearchQuery extends PlannedSearch { preferredDomains: string[]; maxResults: number }
export interface RawSearchResult {
  title: string;
  url: string | null;
  snippet: string;
  sourceOrganization?: string | null;
  sourceLabel?: string | null;
  /** Only set when explicitly supplied as publication metadata. Never page_age. */
  publishedDate?: string | null;
  providerDateHint?: string | null;
  retrievedAt: string;
  provider: string;
  mode: SearchMode;
  /** Discovery depth supplied by the provider. Search metadata is never treated as fetched document content. */
  retrievalStatus?: 'SEARCH_RESULT_ONLY' | 'SOURCE_METADATA_ONLY' | 'DOCUMENT_FETCHED' | 'DOCUMENT_PARSED';
  authors?: string[];
  demoId?: string;
  sourceType?: EvidenceItem['sourceType'];
  sourceAuthority?: EvidenceItem['sourceAuthority'];
}
export interface SearchProvider {
  id: string;
  mode: SearchMode;
  categories: EvidenceType[];
  configured: boolean;
  /** Per-region request budget for this source layer. */
  maxQueriesPerSearch?: number;
  search(query: SearchQuery, signal: AbortSignal): Promise<RawSearchResult[]>;
}
export interface CategorySearchResult {
  category: EvidenceType;
  status: Exclude<SearchStatus, 'waiting' | 'searching' | 'cancelled'>;
  items: EvidenceItem[];
  message: string | null;
  cachedQueries: number;
  providerStats?: ProviderSearchStat[];
}
export interface ProviderSearchStat { provider: string; status: 'COMPLETE'|'PARTIAL'|'FAILED'|'NOT_CONFIGURED'; attemptedQueries: number; resultCount: number }
export interface CategoryProgress {
  category: EvidenceType;
  label: string;
  status: SearchStatus;
  message: string | null;
  cachedQueries: number;
}
export interface DiscoveryState {
  mode: SearchMode;
  running: boolean;
  started: boolean;
  items: EvidenceItem[];
  categories: CategoryProgress[];
}
export interface SearchConfiguration {
  liveConfigured: boolean;
  liveProvider: string;
  providers: { id: string; label: string; configured: boolean; categories: EvidenceType[] }[];
  queriesPerCategory: number;
  resultsPerQuery: number;
}
