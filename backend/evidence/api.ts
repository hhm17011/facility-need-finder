import { regionalQueries } from '../../frontend/services/regional/requirements';
import { issueTypes } from '../../frontend/services/regional/config';
import { regionCatalog, displayName } from '../../frontend/services/geography/regionCatalog';
import { normalizeRegion } from '../../frontend/services/geography/regionNormalizer';
import { analysisSigungu } from '../../frontend/services/geography/sigunguRegistry';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EvidenceType } from '../../frontend/evidenceTypes';
import { interpretFacility } from '../../frontend/services/interpretFacility';
import { planEvidenceSearch } from '../../frontend/services/planEvidenceSearch';
import { buildQueries } from '../../frontend/services/evidence/queryBuilder';
import { createWebSearchProvider } from './providers/webSearchProvider';
import { createDemoProvider } from './providers/demoProvider';
import {createKosisEvidenceProvider} from './providers/kosisEvidenceProvider';
import {createCrossrefProvider} from './providers/crossrefProvider';
import { MemorySearchCache, SearchOrchestrator } from './searchOrchestrator';
import {retrieveRegionalDocuments} from './documentRetriever';
import {createPublicDataPortalProvider} from './providers/publicDataPortalProvider';
import {createNkIsProvider} from './providers/nkisProvider';
import {createLawProvider} from './providers/lawProvider';
import {buildRegionEvidenceQueries,buildSecondPassRegionQueries} from './regionEvidenceQueries';
import {createPublicWebProvider} from './providers/publicWebProvider';
const integer = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value); return value?.trim() && Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
};
export function createEvidenceMiddleware(env: Record<string, string | undefined>) {
  const queriesPerCategory = integer(env.SEARCH_QUERIES_PER_CATEGORY, 2, 1, 3);
  const resultsPerQuery = integer(env.SEARCH_RESULTS_PER_QUERY, 5, 1, 10);
  const ttlMs = integer(env.SEARCH_CACHE_TTL_SECONDS, 300, 0, 3600) * 1000;
  const intervalMs = integer(env.SEARCH_MIN_INTERVAL_MS, 1100, 1000, 10000);
  const live = createWebSearchProvider(env.BRAVE_SEARCH_API_KEY ?? '');
  const kosis = createKosisEvidenceProvider(env.KOSIS_API_KEY ?? '');
  const crossref = createCrossrefProvider();
  const publicWeb=createPublicWebProvider();const publicData=createPublicDataPortalProvider();const nkis=createNkIsProvider(env.NKIS_API_KEY??'');const law=createLawProvider(env.LAW_API_OC??'');
  const liveProviders = [kosis,publicWeb,publicData,nkis,law,crossref,live];
  const runners = {
    live: new SearchOrchestrator(liveProviders, new MemorySearchCache(ttlMs), intervalMs),
    demo: new SearchOrchestrator([createDemoProvider()], new MemorySearchCache(ttlMs), 0),
  };
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/evidence/')) { next(); return; }
    const send = (status: number, payload: unknown) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(payload));
    };
    // The local API cannot be used cross-origin by an unrelated website.
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '') ||
        (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      send(403, { message: '로컬 미리보기에서 요청해 주세요.' }); return;
    }
    if (req.url === '/api/evidence/config' && req.method === 'GET') {
      send(200, { liveConfigured: liveProviders.some(provider=>provider.configured), liveProvider: liveProviders.filter(provider=>provider.configured).map(provider=>provider.id).join(', '),
        providers:[{id:kosis.id,label:'KOSIS 통계',configured:kosis.configured,categories:kosis.categories},{id:publicWeb.id,label:'공개 웹 원문 검색',configured:publicWeb.configured,categories:publicWeb.categories},{id:publicData.id,label:'공공데이터포털 데이터셋',configured:publicData.configured,categories:publicData.categories},{id:nkis.id,label:'NKIS 정책연구',configured:nkis.configured,categories:nkis.categories},{id:law.id,label:'국가법령정보',configured:law.configured,categories:law.categories},{id:crossref.id,label:'Crossref 학술자료',configured:crossref.configured,categories:crossref.categories},{id:live.id,label:'Brave 일반 웹 검색 (선택)',configured:live.configured,categories:live.categories}],queriesPerCategory, resultsPerQuery }); return;
    }
    if (req.url !== '/api/evidence/search' || req.method !== 'POST') { send(404, { message: '지원하지 않는 요청입니다.' }); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { send(415, { message: 'JSON 요청이 필요합니다.' }); return; }
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    try {
      let body = ''; let bytes = 0;
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 12000) { send(413, { message: '입력이 너무 깁니다.' }); return; }
        body += chunk.toString();
      }
      let data: unknown;
      try { data = JSON.parse(body); } catch { send(400, { message: '입력 형식을 확인해 주세요.' }); return; }
      if (!data || typeof data !== 'object') { send(400, { message: '입력을 확인해 주세요.' }); return; }
      const { input, category, mode, regional, selectionContext, screeningRegions } = data as Record<string, unknown>;
      if (typeof input !== 'string' || !input.trim() || input.length > 300 ||
          typeof category !== 'string' || !Object.values(EvidenceType).includes(category as EvidenceType) ||
          (mode !== 'live' && mode !== 'demo')) { send(400, { message: '시설·유형·검색 모드를 확인해 주세요.' }); return; }
      // Rebuild the bounded plan server-side: clients cannot submit arbitrary URLs or workloads.
      const profile = await interpretFacility(input);
      if(screeningRegions!==undefined){if(!Array.isArray(screeningRegions)||screeningRegions.length<5||screeningRegions.length>30||screeningRegions.some(code=>typeof code!=='string'||!analysisSigungu.some(region=>region.regionCode===code))){send(400,{message:'후보 지역 목록을 확인해 주세요.'});return;}const screening:{regionCode:string;candidateDocuments:number;officialDocuments:number}[]=[];for(let offset=0;offset<screeningRegions.length;offset+=5){const batch=screeningRegions.slice(offset,offset+5) as string[];const rows=await Promise.all(batch.map(async regionCode=>{const region=analysisSigungu.find(item=>item.regionCode===regionCode)!;try{const found=await publicWeb.search({category:EvidenceType.RESEARCH,query:`${region.fullName} ${profile.facilityName} 현황 계획`,purpose:'심층 원문 검증 후보를 고르기 위한 경량 공식문서 탐색',priority:'high',geographicScope:region.fullName,preferredSourceTypes:['public_institution_report'],preferredDomains:['go.kr','or.kr','ac.kr'],maxResults:5},controller.signal);return{regionCode,candidateDocuments:found.length,officialDocuments:found.filter(item=>item.sourceAuthority==='LOCAL_GOVERNMENT'||item.sourceAuthority==='REGIONAL_GOVERNMENT'||item.sourceAuthority==='PUBLIC_INSTITUTION').length};}catch{return{regionCode,candidateDocuments:0,officialDocuments:0};}}));screening.push(...rows);}send(200,{screening});return;}
      const plan = planEvidenceSearch(profile);
      let queries = buildQueries(profile, plan, { queriesPerCategory, resultsPerQuery });
      if(selectionContext!==undefined){
        if(!selectionContext||typeof selectionContext!=='object'){send(400,{message:'지역 선택 맥락을 확인해 주세요.'});return;}
        const {regionCode,indicator,pattern,demandPercentile,supplyPercentile}=selectionContext as Record<string,unknown>;
        const selectedRegion=analysisSigungu.find(row=>row.regionCode===regionCode);
        if(!selectedRegion||indicator!=='TARGET_POPULATION'||!['HIGH','MIDDLE','LOW'].includes(String(pattern))||(demandPercentile!==undefined&&(!Number.isFinite(demandPercentile)||Number(demandPercentile)<0||Number(demandPercentile)>100))||(supplyPercentile!==undefined&&(!Number.isFinite(supplyPercentile)||Number(supplyPercentile)<0||Number(supplyPercentile)>100))){send(400,{message:'검증된 지역·지표 맥락이 필요합니다.'});return;}
        if(category===EvidenceType.RESEARCH){
          queries=buildRegionEvidenceQueries(profile,selectedRegion.fullName,resultsPerQuery);
        }
      }
      if (regional !== undefined) {
        if (!regional || typeof regional !== 'object') { send(400, {message:'지역 탐색 조건을 확인해 주세요.'}); return; }
        const {issueType,stage,regionId}=regional as Record<string,unknown>;
        if(typeof issueType!=='string'||!issueTypes.includes(issueType as typeof issueTypes[number])||(stage!=='discovery'&&stage!=='validation')){send(400,{message:'지원하지 않는 이슈·탐색 단계입니다.'});return;}
        const entry=stage==='validation'?regionCatalog.find(entry=>entry.id===regionId&&(entry.level2||entry.level3)):undefined;
        if(stage==='validation'&&!entry){send(400,{message:'발견한 정규 시·군·구를 선택해 주세요.'});return;}
        queries=regionalQueries(profile,issueType as typeof issueTypes[number],stage,entry?normalizeRegion(displayName(entry)):undefined);
        if(!queries.some(query=>query.category===category)){send(400,{message:'지역 탐색 계획에 없는 자료 유형입니다.'});return;}
      }
      const researchStarted=Date.now();
      const result = await runners[mode].searchCategory(category as EvidenceType, queries, controller.signal);
      if(mode==='live'&&category===EvidenceType.RESEARCH&&selectionContext&&typeof selectionContext==='object'){
        const selectedRegion=analysisSigungu.find(row=>row.regionCode===(selectionContext as Record<string,unknown>).regionCode);
        if(selectedRegion){let discovered=result.items.length;const semanticFacilityTerms=profile.facilityName==='어린이집'?['어린이집','국공립 어린이집','보육시설','영유아 보육','보육서비스','보육 인프라','보육기관','육아지원시설','영유아 돌봄','아동 돌봄','보육환경','육아지원']:[];const terms=[profile.facilityName,...semanticFacilityTerms,...(profile.normalizedConcepts??[]),...(profile.relatedFacilityTerms??[]),...(profile.targetUsers??[])],phenomena=['수요','공급','접근성','격차','인프라','인구','인구변화','신도시','주거개발','확충','개원','부족','불균형','우선','증가','감소','대기','정원','이용률',...(profile.demandConcepts??[]),...(profile.supplyConcepts??[]),...(profile.spatialConcepts??[]),'demand','supply','accessibility','disparity','infrastructure','population','planning'],retrievalContext={region:selectedRegion.fullName,facilityTerms:[...new Set(terms)],strongFacilityTerms:[...new Set([profile.facilityName,...semanticFacilityTerms,...(profile.normalizedConcepts??[]),...(profile.relatedFacilityTerms??[])].filter(term=>term!=='돌봄'))],phenomena:[...new Set(phenomena)]};result.items=await retrieveRegionalDocuments(result.items,retrievalContext);let secondPass=false;const initialRegional=result.items.filter(item=>(item.evidenceLevel==='DIRECT'||item.evidenceLevel==='SUPPORTING')&&item.extractedClaims.length>0).length;if(initialRegional<2){secondPass=true;const supplementalQueries=buildSecondPassRegionQueries(profile,selectedRegion.fullName,resultsPerQuery),supplemental=await runners.live.searchCategory(EvidenceType.RESEARCH,supplementalQueries,controller.signal),known=new Set(result.items.map(item=>item.id)),fresh=supplemental.items.filter(item=>!known.has(item.id));discovered+=fresh.length;queries=[...queries,...supplementalQueries];const retrieved=await retrieveRegionalDocuments(fresh,retrievalContext);result.items=[...result.items,...retrieved];result.providerStats=[...(result.providerStats??[]),...(supplemental.providerStats??[])];}const verified=result.items.filter(item=>item.extractedClaims.length>0&&['VERIFIED_HTML','VERIFIED_PDF'].includes(item.contentStatus??''));
const failures=result.items.filter(item=>item.rejectionReason).reduce<Record<string,number>>((counts,item)=>{const reason=item.rejectionReason==='NO_RELEVANT_PASSAGE'?'NO_RELEVANT_PASSAGE':item.rejectionReason==='PDF_EXTRACTION_FAILED'?'PDF_EXTRACTION_FAILED':item.rejectionReason==='CONTENT_EXTRACTION_LOW_QUALITY'?'HTML_EXTRACTION_FAILED':item.rejectionReason?.startsWith('HTTP_403')?'BLOCKED':item.rejectionReason==='TIMEOUT'?'TIMEOUT':item.rejectionReason==='CONTENT_UNAVAILABLE'?'FETCH_FAILED':item.rejectionReason??'FETCH_FAILED';counts[reason]=(counts[reason]??0)+1;return counts;},{});console.info('[RESEARCH]',{facility:profile.facilityName,region:selectedRegion.fullName,queries:queries.map(query=>query.query),searchResults:discovered,candidateUrls:result.items.filter(item=>item.url).length,retrievedDocuments:result.items.filter(item=>item.contentStatus&&item.contentStatus!=='METADATA_ONLY').length,extractedDocuments:result.items.filter(item=>item.retrievalStatus==='DOCUMENT_PARSED').length,relevantPassages:verified.reduce((sum,item)=>sum+item.extractedClaims.length,0),verifiedEvidence:verified.length,secondPass,failedSources:failures,elapsedMs:Date.now()-researchStarted});}
      }
      send(200, result);
    } catch {
      if (!controller.signal.aborted) {
        console.warn('[evidence-api]', { code: 'REQUEST_FAILED' });
        send(500, { message: '근거 탐색 요청을 처리하지 못했습니다. 다시 시도해 주세요.' });
      }
    } finally { res.off('close', abort); }
  };
}
