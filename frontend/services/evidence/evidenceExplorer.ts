import type { EvidenceSearchPlan, FacilityProfile } from '../../evidenceTypes';
import { deduplicateEvidence } from './evidenceNormalizer';
import type { CategorySearchResult, DiscoveryState, SearchConfiguration, SearchMode } from './types';
export async function getSearchConfiguration(signal?: AbortSignal): Promise<SearchConfiguration> {
  const response = await fetch('/api/evidence/config', { signal });
  if (!response.ok) throw new Error('검색 설정을 확인하지 못했습니다. 로컬 서버 연결을 확인해 주세요.');
  return response.json();
}
export function initialDiscovery(plan: EvidenceSearchPlan, mode: SearchMode): DiscoveryState {
  return { mode, started: false, running: false, items: [], categories: plan.evidenceCategories.map(category => ({
    category: category.type, label: category.label, status: 'waiting', message: null, cachedQueries: 0,
  })) };
}
export interface EvidenceSelectionContext {regionCode:string;indicator:'TARGET_POPULATION';pattern:'HIGH'|'MIDDLE'|'LOW'}
export async function exploreEvidence(profile: FacilityProfile, plan: EvidenceSearchPlan, mode: SearchMode, onProgress: (state: DiscoveryState) => void, signal: AbortSignal, selectionContext?:EvidenceSelectionContext): Promise<void> {
  let state: DiscoveryState = { ...initialDiscovery(plan, mode), started: true, running: true };
  const emit = () => onProgress({ ...state, categories: state.categories.map(category => ({ ...category })), items: [...state.items] });
  emit();
  for (let index = 0; index < state.categories.length; index++) {
    if (signal.aborted) break;
    const progress = state.categories[index]; progress.status = 'searching'; emit();
    try {
      const response = await fetch('/api/evidence/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: profile.originalInput, category: progress.category, mode, selectionContext }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
      });
      if (!response.ok) throw new Error('SEARCH_REQUEST_FAILED');
      const result: CategorySearchResult = await response.json();
      progress.status = result.status; progress.message = result.message; progress.cachedQueries = result.cachedQueries;
      // No cross-mode results, even if an erroneous provider response slips through.
      state.items = deduplicateEvidence([...state.items, ...result.items.filter(item => item.mode === mode)]);
    } catch {
      if (signal.aborted) break;
      progress.status = 'error'; progress.message = '검색 중 일부 소스에 연결하지 못했습니다. 로컬 서버와 검색 설정을 확인해 주세요.';
    }
    emit();
  }
  if (signal.aborted) state.categories = state.categories.map(category => ['waiting', 'searching'].includes(category.status) ? { ...category, status: 'cancelled' } : category);
  state.running = false; emit();
}
