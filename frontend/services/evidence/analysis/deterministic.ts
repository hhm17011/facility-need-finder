import type { EvidenceItem } from '../../../evidenceTypes';
import { canonicalUrl } from '../evidenceNormalizer';
import { evaluationConfig as config } from './config';
import type { DimensionAssessment, RegionalLevel } from './types';
export const unknown = (reason: string, status: DimensionAssessment['status'] = 'unknown'): DimensionAssessment => ({ score: null, status, reason, method: 'unresolved', signals: [] });
const assessed = (score: number, reason: string, signals: string[]): DimensionAssessment => ({ score, status: 'evaluated', reason, signals, method: 'deterministic' });
export function publicationTime(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10) ? parsed.getTime() : null;
}
export function textSignals(item: EvidenceItem) {
  const text = `${item.title} ${item.snippet}`.trim();
  // Years alone are not quantitative findings. Values are observed, never manufactured.
  const quantities = [...text.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:%|명|개소|가구|세대|곳|건)(?=$|[^가-힣]|[이가은는을를의에와과])/g)].map(match => match[0]);
  const sample = /표본|응답자|조사\s*대상|조사\s*참여자/.test(text) && quantities.length > 0;
  const comparison = /전년\s*대비|전후\s*비교|지역\s*간\s*비교|지역별\s*비교|증가|감소/.test(text) && quantities.length > 0;
  const explicitStatement = /연구\s*결과|조사\s*결과|설치하여야|확보하여야|설치해야/.test(text);
  const promotional = /최고의|최상의|지금\s*신청|특별\s*할인|홍보/.test(text);
  return { text, quantities, sample, comparison, explicitStatement, promotional };
}
export function evaluateReliability(item: EvidenceItem, referenceTime: number): DimensionAssessment {
  if (!item.url || !canonicalUrl(item.url)) return unknown('추적 가능한 원문 URL이 없어 출처 신뢰성을 평가할 수 없습니다.', 'requires_source_verification');
  const organization = item.sourceOrganization?.trim();
  const site = item.sourceLabel?.trim();
  if (!organization && !site) return unknown('원문 URL만 있고 기관·사이트 식별 정보가 없습니다. 도메인만으로 신뢰성을 점수화하지 않습니다.', 'requires_source_verification');
  const weights = config.reliability;
  let score = organization ? weights.organization : weights.siteLabel;
  const signals = [organization ? `기관 메타데이터: ${organization} (+${weights.organization})` : `사이트 표시명: ${site} (+${weights.siteLabel})`, `추적 가능한 URL (+${weights.url})`];
  score += weights.url;
  const host = new URL(item.url).hostname;
  // Only a supporting signal after independent publisher metadata is present.
  if (/(^|\.)go\.kr$/.test(host)) { score += weights.officialDomain; signals.push(`정부 도메인 형태: ${host} (+${weights.officialDomain}, 기관 진위 보증 아님)`); }
  const published = publicationTime(item.publishedDate);
  if (published !== null && published <= referenceTime) { score += weights.dated; signals.push(`제공된 발행일: ${item.publishedDate} (+${weights.dated})`); }
  if (textSignals(item).sample) { score += weights.methodology; signals.push(`조사 대상·수량 표현 있음 (+${weights.methodology}, 조사 방법 검증 아님)`); }
  return assessed(Math.min(weights.cap, score), `출처 식별·추적 가능성과 표시된 조사 정보를 조합한 잠정 점수입니다(상한 ${weights.cap}). 원문 진위·기관 권위·동료심사는 검증하지 않았습니다.`, signals);
}
export function evaluateRecency(item: EvidenceItem, referenceTime: number): DimensionAssessment {
  const published = publicationTime(item.publishedDate);
  if (published === null) return unknown('확인 가능한 발행일이 없습니다. 발견 시각·수정일 추정값으로 대체하지 않습니다.');
  if (published > referenceTime) return unknown('발행일이 평가 기준일보다 미래여서 최신성을 평가하지 않습니다.');
  const text = `${item.title} ${item.snippet}`;
  if (/법률|법령|시행령|시행규칙|조례/.test(text)) return unknown('법령 표현이 있는 자료는 발행일만으로 현행성을 판단할 수 없습니다. 현행 여부·개정 이력 확인이 필요합니다.', 'requires_source_verification');
  const research = item.categories.includes('RESEARCH') || /기초\s*연구|이론적|이론\s*연구|개념적/.test(text);
  const sensitive = item.categories.some(category => ['STATISTICS', 'DEMAND_SURVEY', 'SURVEY', 'NEWS'].includes(category));
  // Multi-category discovery metadata is provisional; newer local-status evidence uses the shorter horizon.
  const schedule = sensitive ? config.recency.timeSensitive : research ? config.recency.research : config.recency.general;
  const context = sensitive ? '현황·조사·기사 탐색 맥락' : research ? '연구의 장기 참고 가능성' : '일반 자료 맥락';
  const age = (referenceTime - published) / (365.25 * 24 * 60 * 60 * 1000);
  const band = schedule.find(([years]) => age <= years)!;
  return assessed(band[1], `${context}을 고려한 발행 후 경과기간 규칙입니다. 오래된 자료의 내용 가치나 사실 여부를 판단하는 점수는 아닙니다.`, [`발행일: ${item.publishedDate}`, `기준일: ${new Date(referenceTime).toISOString().slice(0, 10)}`, `경과 약 ${age.toFixed(1)}년 · ${Number.isFinite(band[0]) ? `${band[0]}년 이내` : '장기 경과'} 구간 → ${band[1]}점`]);
}
export function evaluateRegion(item: EvidenceItem): { assessment: DimensionAssessment; level: RegionalLevel } {
  const text = `${item.title} ${item.snippet}`;
  const explicit = item.mentionedRegions.filter(region => text.includes(region.name));
  const province = /(?:서울특별시|[가-힣]+광역시|세종특별자치시|[가-힣]+특별자치도|경기도|충청[남북]도|전라[남북]도|경상[남북]도)/;
  const district = text.match(new RegExp(`${province.source}\\s+([가-힣]{1,8}(?:시|군|구|읍|면|동))(?=$|[^가-힣]|의|에서|은|는|에)`));
  const local = explicit.find(region => !province.test(region.name) && /(?:시|군|구|읍|면|동)$/.test(region.name));
  if (district || local) return { level: 'local', assessment: assessed(config.regional.local, '시·군·구 이하 지명이 제목·스니펫에 명시되어 있습니다. 지명 언급만 확인했으며 지역 수요를 직접 입증했다는 뜻은 아닙니다.', [district?.[0] ?? local!.name]) };
  const broad = explicit.find(region => province.test(region.name))?.name ?? text.match(province)?.[0];
  if (broad) return { level: 'provincial', assessment: assessed(config.regional.provincial, '광역시·도 수준 지명이 명시되어 있습니다. 세부 생활권·수요의 직접성은 미확인입니다.', [broad]) };
  if (/전국|대한민국/.test(text) || /^(전국|대한민국)$/.test(item.geographicScope.trim())) return { level: 'national', assessment: assessed(config.regional.national, '전국 범위 자료입니다. 지역 특정성은 낮지만 일반 문제를 설명하는 자료로 보존합니다.', ['명시된 전국 범위']) };
  return { level: 'unknown', assessment: unknown('제목·스니펫에서 평가 가능한 지역 범위를 확인하지 못했습니다. 검색 범위를 원문의 범위로 추정하지 않습니다.') };
}
export function evaluateSpecificity(item: EvidenceItem): DimensionAssessment {
  const signals = textSignals(item);
  if (signals.text.length < config.specificity.minimumTextLength && !signals.quantities.length) return unknown('평가할 제목·스니펫 정보가 너무 적습니다. 자료 자체의 품질이 낮다는 뜻은 아닙니다.');
  const weights = config.specificity;
  let score = weights.narrative;
  const reasons = [`평가 가능한 텍스트 있음 (+${weights.narrative})`];
  if (signals.quantities.length) { score += weights.quantity; reasons.push(`관찰된 수량: ${signals.quantities.slice(0, 4).join(', ')} (+${weights.quantity})`); }
  if (signals.sample) { score += weights.sample; reasons.push(`표본·조사 대상과 수량 표현 (+${weights.sample})`); }
  if (signals.comparison) { score += weights.comparison; reasons.push(`수량과 변화·비교 표현 (+${weights.comparison})`); }
  if (signals.explicitStatement) { score += weights.explicitStatement; reasons.push(`연구·조사 결과 또는 요구사항 표현 (+${weights.explicitStatement})`); }
  if (signals.promotional) { score -= weights.promotionalPenalty; reasons.push(`홍보성 표현 (-${weights.promotionalPenalty})`); }
  return assessed(Math.max(0, Math.min(weights.cap, score)), `제목·스니펫에 실제 있는 표현의 구체성만 평가합니다(상한 ${weights.cap}). 수치의 정확성·비교 대상·결론의 타당성은 검증하지 않았습니다.`, reasons);
}
