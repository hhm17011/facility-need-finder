import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' });
after(async () => { await vite.close(); });
const load = path => vite.ssrLoadModule(path);
const { interpretFacility } = await load('/frontend/services/interpretFacility.ts');
const { planEvidenceSearch } = await load('/frontend/services/planEvidenceSearch.ts');
const { buildQueries } = await load('/frontend/services/evidence/queryBuilder.ts');
const { normalizeEvidence, deduplicateEvidence, canonicalUrl, extractRegions } = await load('/frontend/services/evidence/evidenceNormalizer.ts');
const { SearchOrchestrator, MemorySearchCache } = await load('/backend/evidence/searchOrchestrator.ts');
const { createWebSearchProvider, providerQuery } = await load('/backend/evidence/providers/webSearchProvider.ts');
const { createDemoProvider } = await load('/backend/evidence/providers/demoProvider.ts');
const {createKosisEvidenceProvider}=await load('/backend/evidence/providers/kosisEvidenceProvider.ts');
const {createCrossrefProvider}=await load('/backend/evidence/providers/crossrefProvider.ts');
const { createEvidenceMiddleware } = await load('/backend/evidence/api.ts');
const { retrieveRegionalDocuments } = await load('/backend/evidence/documentRetriever.ts');
const {createPublicDataPortalProvider}=await load('/backend/evidence/providers/publicDataPortalProvider.ts');
const {createNkIsProvider}=await load('/backend/evidence/providers/nkisProvider.ts');
const {createLawProvider}=await load('/backend/evidence/providers/lawProvider.ts');
const {buildRegionEvidenceQueries}=await load('/backend/evidence/regionEvidenceQueries.ts');
const {parsePublicWebResults}=await load('/backend/evidence/providers/publicWebProvider.ts');
const profile = await interpretFacility('도서관');
const plan = planEvidenceSearch(profile);
const queries = buildQueries(profile, plan);
const query = queries[0];
const signal = () => new AbortController().signal;
// Reserved example domains are test fixtures, never application discovery data.
const raw = (changes={}) => ({title:'TEST ONLY: 용인시 자료',url:'https://example.org/report?id=7&utm_source=test#page2',snippet:'TEST ONLY: 평택시 설문 메타데이터',sourceOrganization:null,publishedDate:null,retrievedAt:'2026-09-18T00:00:00.000Z',provider:'test-only',mode:'live',...changes});
const provider = search => ({ id:'test-only',mode:'live',configured:true,categories:plan.evidenceCategories.map(c=>c.type),search });

test('facility-dependent bounded queries include public reports and domain preferences', async()=>{
 assert.equal(queries.length,14);assert.equal(queries.filter(q=>q.category==='PUBLIC_REPORT').length,2);
 assert.ok(queries.every(q=>q.query.includes('도서관')&&q.maxResults===5));
 assert.ok(providerQuery(query).includes('site:law.go.kr'));
 const daycare=await interpretFacility('어린이집');
 assert.notEqual(JSON.stringify(buildQueries(daycare,planEvidenceSearch(daycare))),JSON.stringify(queries));
 const limited=buildQueries(profile,plan,{queriesPerCategory:99,resultsPerQuery:999});
 assert.ok(limited.every(q=>q.maxResults===10));assert.ok(limited.length<=21);
});
test('normalizer preserves original URLs, keeps unknown dates null and never evaluates',()=>{
 const item=normalizeEvidence(raw(),query);
 assert.equal(item.url,raw().url);assert.equal(item.publishedDate,null);assert.equal(item.summary,'');
 assert.deepEqual(item.mentionedRegions.map(r=>r.name),['용인시','평택시']);
 assert.ok(Object.values(item.evaluation).every(v=>v===null));assert.deepEqual(item.extractedClaims,[]);
 assert.equal(item.geographicScope,'원문 범위 미확인');
 assert.equal(normalizeEvidence(raw({url:'javascript:alert(1)'}),query),null);
 assert.equal(normalizeEvidence(raw({url:null}),query),null);
 assert.equal(normalizeEvidence(raw({publishedDate:'2025-02-30'}),query).publishedDate,null);
 assert.equal(normalizeEvidence(raw({publishedDate:'2025-02-28'}),query).publishedDate,'2025-02-28');
 assert.deepEqual(extractRegions('지역에 대한 내용이 없습니다.'),[]);
 assert.deepEqual(extractRegions('서울특별시에서 개최'),[{name:'서울특별시',regionCode:null}]);
});
test('region evidence scope follows explicit source geography instead of the search query alone',()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'경기도 평택시'};
 const direct=normalizeEvidence(raw({title:'TEST ONLY 평택시 보육시설 연구',snippet:''}),regionalQuery);
 const province=normalizeEvidence(raw({title:'TEST ONLY 경기도 보육 정책 연구',snippet:'',url:'https://example.org/province'}),regionalQuery);
 const national=normalizeEvidence(raw({title:'TEST ONLY 전국 보육시설 연구',snippet:'',url:'https://example.org/national'}),regionalQuery);
 assert.equal(direct.regionEvidenceScope,'SIGUNGU_DIRECT');assert.equal(direct.geographicScope,'경기도 평택시');
 assert.equal(province.regionEvidenceScope,'SIDO_CONTEXT');assert.equal(province.geographicScope,'경기도');
 assert.equal(national.regionEvidenceScope,'NATIONAL_CONTEXT');assert.equal(national.geographicScope,'전국 또는 지역 미특정');
});
test('accessible HTML becomes verified regional evidence only from matching document text',async()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'경기도 평택시'};
 const item=normalizeEvidence(raw({title:'평택시 어린이집 연구',snippet:'',url:'https://public.example/report'}),regionalQuery);
 const document='<html><title>전국 보육 연구</title><nav>평택시 어린이집 메뉴</nav><main><h2>지역 보육계획</h2><p>이 문서는 지역의 인구 변화와 생활권 계획을 함께 검토한 공공 보고서이다.</p><p>평택시는 영유아 인구 변화에 대응하기 위해 어린이집 공급 현황과 보육 수요를 함께 점검하였다.</p><p>향후 계획에서는 생활권별 시설 분포 자료를 추가로 조사할 필요가 있다고 설명한다.</p></main></html>';
 const [verified]=await retrieveRegionalDocuments([item],{region:'경기도 평택시',facilityTerms:['어린이집','보육'],phenomena:['수요','공급']},async()=>new Response(document,{headers:{'content-type':'text/html'}}));
 assert.equal(verified.contentStatus,'VERIFIED_HTML');assert.equal(verified.retrievalStatus,'DOCUMENT_PARSED');assert.equal(verified.regionEvidenceScope,'SIGUNGU_DIRECT');assert.equal(verified.extractedClaims.length,1);assert.ok(verified.extractedClaims[0].sourcePassage.includes('평택시'));assert.ok(!verified.extractedClaims[0].sourcePassage.includes('향후 계획'));assert.ok(verified.evidenceSummary);assert.ok(verified.relevanceReason);assert.match(verified.extractedClaims[0].sourceLocator,/문단 2/);
 assert.equal(verified.evidenceLevel,'DIRECT');
});
test('official regional document provenance supports a facility passage without repeating the region in every paragraph',async()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'경기도 평택시'};
 const normalized=normalizeEvidence(raw({title:'평택시 지역사회보장계획',snippet:'보육서비스 계획',url:'https://pyeongtaek.go.kr/report'}),regionalQuery);
 const item={...normalized,sourceType:'LOCAL_PLAN',sourceAuthority:'LOCAL_GOVERNMENT'};
 const document='<html><main><h2>영유아 보육</h2><p>영유아 보육서비스 이용 기반을 확대하고 국공립 어린이집 공급 계획을 추진한다.</p><p>사업별 담당 부서와 추진 일정을 다음 표에 제시하며 연도별 운영 현황을 정기적으로 점검한다.</p><p>세부 사업은 보육환경 변화와 서비스 이용 현황을 바탕으로 담당 부서가 시행한다.</p></main></html>';
 const [verified]=await retrieveRegionalDocuments([item],{region:'경기도 평택시',facilityTerms:['어린이집','영유아 보육','보육서비스'],phenomena:['이용','공급','확대','계획']},async()=>new Response(document,{headers:{'content-type':'text/html'}}));
 assert.equal(verified.regionEvidenceScope,'SIGUNGU_DIRECT');assert.equal(verified.evidenceLevel,'SUPPORTING');assert.equal(verified.extractedClaims.length,1);
});
test('title and navigation matches never become verified evidence without matching body content',async()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'경기도 평택시'};const item=normalizeEvidence(raw({title:'평택시 어린이집 공급 연구',snippet:'',url:'https://public.example/title-only'}),regionalQuery);
 const body='<html><title>평택시 어린이집 공급 연구</title><nav>평택시 보육 수요</nav><main><p>이 문서는 전혀 다른 산업 분야의 일반적인 행정 절차를 설명하는 자료입니다.</p><p>본문에는 문서 처리 절차와 담당 부서 연락 방법만 상세하게 수록되어 있습니다.</p><p>자료의 작성과 보존에 관한 일반 원칙을 소개하고 관련 서식을 안내합니다.</p></main></html>';
 const [rejected]=await retrieveRegionalDocuments([item],{region:'경기도 평택시',facilityTerms:['어린이집','보육'],phenomena:['수요','공급']},async()=>new Response(body,{headers:{'content-type':'text/html'}}));assert.equal(rejected.contentStatus,'NO_RELEVANT_CLAIM');assert.equal(rejected.extractedClaims.length,0);assert.equal(rejected.rejectionReason,'NO_RELEVANT_PASSAGE');
});
test('commercial childcare directories cannot become regional evidence',async()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'인천광역시 연수구'};const item=normalizeEvidence(raw({title:'연수구 다온어린이집 정원 안내',snippet:'어린이집 공급 현황',url:'https://imjangon.co.kr/childcare/28185/6606'}),regionalQuery);
 const [rejected]=await retrieveRegionalDocuments([item],{region:'인천광역시 연수구',facilityTerms:['어린이집'],phenomena:['공급','정원']},async()=>new Response('<main><p>연수구 다온어린이집 정원과 공급 정보를 안내합니다.</p><p>시설 상세 내용과 주변 정보를 함께 제공합니다.</p><p>이용자는 목록에서 다른 시설도 찾아볼 수 있습니다.</p></main>',{headers:{'content-type':'text/html'}}));assert.equal(rejected.contentStatus,'METADATA_ONLY');assert.equal(rejected.extractedClaims.length,0);
});
test('unreadable PDF is explicit and never promoted to verified evidence',async()=>{
 const regionalQuery={...query,category:'RESEARCH',geographicScope:'경기도 평택시'};const item=normalizeEvidence(raw({title:'평택시 어린이집 PDF',snippet:'',url:'https://public.example/report.pdf'}),regionalQuery);
 const [failed]=await retrieveRegionalDocuments([item],{region:'경기도 평택시',facilityTerms:['어린이집'],phenomena:['수요']},async()=>new Response(new Uint8Array([37,80,68,70,45]),{headers:{'content-type':'application/pdf'}}));
 assert.equal(failed.contentStatus,'PDF_EXTRACTION_FAILED');assert.equal(failed.extractedClaims.length,0);
});
test('unknown facility creates bounded input-derived research concepts',async()=>{
 const unknown=await interpretFacility('메이커스페이스');const unknownPlan=planEvidenceSearch(unknown);const childcare=await interpretFacility('어린이집');const culture=await interpretFacility('복합문화시설');const kitchen=await interpretFacility('공유주방');
 assert.ok(unknown.normalizedConcepts.includes('메이커스페이스'));assert.ok(unknown.relatedFacilityTerms.includes('메이커스페이스'));assert.ok(unknown.researchQuestions.length>=3);
 assert.notDeepEqual(unknown.normalizedConcepts,childcare.normalizedConcepts);assert.notDeepEqual(culture.normalizedConcepts,kitchen.normalizedConcepts);assert.ok(buildQueries(unknown,unknownPlan).every(row=>row.query.includes('메이커스페이스')));assert.ok(buildQueries(culture,planEvidenceSearch(culture)).every(row=>row.query.includes('문화시설')));assert.ok(buildQueries(kitchen,planEvidenceSearch(kitchen)).every(row=>row.query.includes('공유주방')));
});
test('URL dedup merges discovery categories but preserves original source and meaningful IDs',()=>{
 const first=normalizeEvidence(raw(),query);
 const second=normalizeEvidence(raw({url:'https://example.org/report?id=7&utm_medium=other#page3'}),{...query,category:'RESEARCH'});
 const items=deduplicateEvidence([first,second]);
 assert.equal(items.length,1);assert.equal(items[0].url,first.url);assert.deepEqual(items[0].categories,['LAW_POLICY','RESEARCH']);
 assert.notEqual(canonicalUrl('https://example.org/?id=1'),canonicalUrl('https://example.org/?id=2'));
 assert.notEqual(canonicalUrl('https://example.org/#/a'),canonicalUrl('https://example.org/#/b'));
});
test('no API key returns explicit unconfigured state without a network call',async()=>{
 const live=createWebSearchProvider('',async()=>{throw Error('Should not fetch');});
 const result=await new SearchOrchestrator([live],new MemorySearchCache(),0).searchCategory('LAW_POLICY',queries,signal());
 assert.equal(result.status,'unconfigured');assert.equal(result.message,'검색 API가 설정되지 않았습니다.');assert.deepEqual(result.items,[]);
});
test('demo is isolated, labeled and has no invented source links',async()=>{
 const result=await new SearchOrchestrator([createDemoProvider()],new MemorySearchCache(),0).searchCategory('LAW_POLICY',queries,signal());
 assert.equal(result.status,'complete');assert.equal(result.items.length,1);
 assert.ok(result.items.every(i=>i.mode==='demo'&&i.title.includes('DEMO')&&i.url===null&&i.sourceOrganization===null));
});
test('empty successful search remains empty',async()=>{
 const result=await new SearchOrchestrator([provider(async()=>[])],new MemorySearchCache(),0).searchCategory('LAW_POLICY',queries,signal());
 assert.equal(result.status,'complete');assert.deepEqual(result.items,[]);
});
test('provider failure is partial when another provider succeeds; future categories continue',async()=>{
 const bad={...provider(async()=>{throw Error('secret-value-must-not-log');}),id:'failed-test-only'};
 const good=provider(async()=>[raw()]);
 const runner=new SearchOrchestrator([bad,good],new MemorySearchCache(),0);
 const result=await runner.searchCategory('LAW_POLICY',queries,signal());
 assert.equal(result.status,'partial');assert.equal(result.items.length,1);assert.ok(!result.message.includes('secret'));
 assert.equal((await runner.searchCategory('NEWS',queries,signal())).items.length,1);
});
test('successful duplicate and empty queries are cached; retrieval date remains unchanged',async()=>{
 let calls=0;const runner=new SearchOrchestrator([provider(async()=>{calls++;return [raw()];})],new MemorySearchCache(),0);
 const first=await runner.searchCategory('LAW_POLICY',queries,signal());
 const second=await runner.searchCategory('LAW_POLICY',queries,signal());
 assert.equal(calls,2);assert.equal(second.cachedQueries,2);assert.equal(second.items[0].retrievedAt,first.items[0].retrievedAt);
 let emptyCalls=0;const emptyRunner=new SearchOrchestrator([provider(async()=>{emptyCalls++;return [];})],new MemorySearchCache(),0);
 await emptyRunner.searchCategory('NEWS',queries,signal());await emptyRunner.searchCategory('NEWS',queries,signal());assert.equal(emptyCalls,2);
});
test('cache expiration and disabled cache work',async()=>{
 const cache=new MemorySearchCache(1);cache.set('a',[raw()]);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(cache.get('a'),undefined);
 const disabled=new MemorySearchCache(0);disabled.set('a',[]);assert.equal(disabled.get('a'),undefined);
});
test('server queue never overlaps provider calls and aborted searches stop',async()=>{
 let active=0,max=0;
 const runner=new SearchOrchestrator([provider(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return []})],new MemorySearchCache(0),0);
 await Promise.all([runner.searchCategory('LAW_POLICY',queries,signal()),runner.searchCategory('NEWS',queries,signal())]);assert.equal(max,1);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>runner.searchCategory('LAW_POLICY',queries,controller.signal));
});
test('Brave adapter uses documented request and does not treat page age or site name as verified publication metadata',async()=>{
 let sent;const live=createWebSearchProvider('test-key-not-a-real-secret',async(url,options)=>{sent={url:String(url),options};return Response.json({type:'search',web:{results:[{title:'<b>TEST ONLY</b>',url:'https://example.org/source',description:'TEST ONLY snippet',page_age:'2025-01-01',profile:{name:'Test site label'}}]}});});
 const rows=await live.search(query,signal());
 assert.equal(new URL(sent.url).origin,'https://api.search.brave.com');assert.equal(sent.options.headers['X-Subscription-Token'],'test-key-not-a-real-secret');
 assert.ok(!sent.url.includes('test-key'));assert.equal(rows[0].publishedDate,null);assert.equal(rows[0].providerDateHint,'2025-01-01');assert.equal(rows[0].sourceOrganization,null);assert.equal(rows[0].sourceLabel,'Test site label');
 assert.equal(normalizeEvidence(rows[0],query).title,'TEST ONLY');
});
test('KOSIS evidence adapter uses focused official search and preserves its original table URL',async()=>{
 let request;const client={request:async(path,params)=>{request={path,params};return {retrievedAt:'2026-09-25T00:00:00Z',rows:[{TBL_NM:'어린이집 설치 · 운영 현황',STAT_NM:'어린이집및이용자통계',ORG_NM:'교육부',LINK_URL:'http://kosis.kr/statHtml/statHtml.do?orgId=112&tblId=DT_TEST'}]};}};
 const provider=createKosisEvidenceProvider('TEST-ONLY',client);const q={...queries.find(q=>q.category==='STATISTICS'),query:'어린이집 지역별 통계'};const rows=await provider.search(q,signal());
 assert.equal(request.path,'statisticsSearch.do');assert.equal(request.params.searchNm,'어린이집');assert.equal(rows[0].provider,'kosis-search');assert.equal(rows[0].mode,'live');assert.equal(rows[0].sourceOrganization,'교육부');assert.equal(rows[0].url,'https://kosis.kr/statHtml/statHtml.do?orgId=112&tblId=DT_TEST');
});
test('Crossref adapter needs no key and preserves real scholarly metadata fields',async()=>{
 let sent;const provider=createCrossrefProvider(async(url,options)=>{sent={url:String(url),options};return Response.json({message:{items:[{DOI:'10.1234/test',title:['어린이집 공간환경 연구'],published:{'date-parts':[[2024,3,2]]},URL:'https://doi.org/10.1234/test',publisher:'TEST 학회',abstract:'<jats:p>공간환경 연구 초록</jats:p>',type:'journal-article'}]}});});
 const q={...queries.find(q=>q.category==='RESEARCH'),query:'어린이집 공간 환경'};const rows=await provider.search(q,signal());
 assert.equal(provider.configured,true);assert.equal(new URL(sent.url).origin,'https://api.crossref.org');assert.equal(rows[0].publishedDate,'2024-03-02');assert.equal(rows[0].provider,'crossref');assert.equal(rows[0].url,'https://doi.org/10.1234/test');assert.equal(normalizeEvidence(rows[0],q).mode,'live');
});
test('regional childcare query expansion is bounded, regional and observation-oriented',async()=>{
 const childcare=await interpretFacility('어린이집');const rows=buildRegionEvidenceQueries(childcare,'경기도 평택시',5);
 assert.equal(rows.length,9);assert.ok(rows.every(row=>row.geographicScope==='경기도 평택시'&&row.category==='RESEARCH'));
 assert.ok(rows.some(row=>row.query==='평택시 어린이집 보육 계획 PDF'));assert.ok(rows.some(row=>row.query.includes('영유아 인구')));
});
test('public web discovery keeps external official document URLs and excludes search-engine links',()=>{
 const rows=parsePublicWebResults('<a href="https://search.naver.com/x">검색</a><a href="https://eminwon.pyeongtaek.go.kr/file.pdf">평택시 지역사회보장계획 PDF</a>','2026-09-26T00:00:00Z');
 assert.equal(rows.length,1);assert.equal(rows[0].provider,'public-web');assert.equal(rows[0].sourceType,'LOCAL_REPORT');assert.equal(rows[0].url,'https://eminwon.pyeongtaek.go.kr/file.pdf');
});
test('public data catalog parses official dataset metadata without promoting it to evidence',async()=>{
 const html='<div class="apply-result-item"><a href="/data/15003449/fileData.do">한국영유아보육교육진흥원_공공형 <em>어린이집</em> 현황</a><span class="apply-result-summary">지역별 공공형 어린이집 데이터</span><strong>제공기관</strong><span>한국영유아보육교육진흥원</span><strong>수정일</strong><span>2026-01-02</span></div>';
 let sent;const adapter=createPublicDataPortalProvider(async url=>{sent=String(url);return new Response(html,{headers:{'content-type':'text/html'}})});const rows=await adapter.search({...query,category:'RESEARCH',query:'평택시 어린이집'},signal());
 assert.ok(sent.includes('data.go.kr'));assert.equal(rows[0].sourceType,'PUBLIC_DATA');assert.equal(rows[0].retrievalStatus,'SOURCE_METADATA_ONLY');assert.ok(rows[0].url.startsWith('https://www.data.go.kr/data/'));
});
test('NKIS and law adapters isolate missing credentials and parse official response shapes',async()=>{
 assert.equal(createNkIsProvider('').configured,false);assert.equal(createLawProvider('').configured,false);
 const nkis=createNkIsProvider('TEST',async()=>new Response('<root><result><OTP_HAN_NM>지역별 보육시설 수급 연구</OTP_HAN_NM><PUBAGC>국책연구원</PUBAGC><PBL_YY>2025</PBL_YY><ORG_LINK>https://www.nkis.re.kr/report</ORG_LINK></result></root>'));
 assert.equal((await nkis.search({...query,category:'RESEARCH'},signal()))[0].sourceType,'POLICY_RESEARCH');
 const law=createLawProvider('TEST',async()=>Response.json({LawSearch:{law:[{'법령명한글':'영유아보육법','법령상세링크':'/법령/영유아보육법','소관부처명':'교육부','공포일자':'20250101'}]}}));
 const lawRows=await law.search({...query,category:'RESEARCH',query:'평택시 어린이집'},signal());assert.equal(lawRows[0].sourceType,'LAW');assert.equal(lawRows[0].publishedDate,'2025-01-01');
});
test('provider budgets and explicit NOT_CONFIGURED status survive a mixed search',async()=>{
 let calls=0;const capped={...provider(async()=>{calls++;return[]}),id:'capped',maxQueriesPerSearch:2};const missing={...provider(async()=>[]),id:'missing',configured:false};
 const result=await new SearchOrchestrator([capped,missing],new MemorySearchCache(0),0).searchCategory(query.category,[query,{...query,query:'two'},{...query,query:'three'}],signal());
 assert.equal(calls,2);assert.equal(result.providerStats.find(row=>row.provider==='capped').attemptedQueries,2);assert.equal(result.providerStats.find(row=>row.provider==='missing').status,'NOT_CONFIGURED');
});
test('rate limits are safe, do not retry every query, and do not return mock fallback',async()=>{
 let calls=0;const live=createWebSearchProvider('test-key',async()=>{calls++;return new Response('SECRET RAW ERROR',{status:429});});
 const runner=new SearchOrchestrator([live],new MemorySearchCache(),0);
 const result=await runner.searchCategory('LAW_POLICY',queries,signal());
 assert.equal(result.status,'error');assert.equal(calls,1);assert.deepEqual(result.items,[]);assert.ok(!result.message.includes('SECRET'));
 await runner.searchCategory('NEWS',queries,signal());assert.equal(calls,1);
});
test('local API rejects cross-origin and exposes configuration without keys',async()=>{
 const middleware=createEvidenceMiddleware({BRAVE_SEARCH_API_KEY:'test-secret'});
 function response(){return {destroyed:false,writableEnded:false,writeHead(code){this.code=code;},end(body){this.body=JSON.parse(body);}};}
 const bad=response();await middleware({url:'/api/evidence/config',method:'GET',headers:{host:'127.0.0.1:5173',origin:'https://unrelated.example'}},bad,()=>{});assert.equal(bad.code,403);
 const good=response();await middleware({url:'/api/evidence/config',method:'GET',headers:{host:'127.0.0.1:5173'}},good,()=>{});assert.equal(good.code,200);assert.equal(good.body.liveConfigured,true);assert.ok(!JSON.stringify(good.body).includes('test-secret'));
 assert.ok(good.body.providers.some(p=>p.id==='crossref'&&p.configured));assert.ok(good.body.providers.some(p=>p.id==='kosis-search'&&!p.configured));
});
