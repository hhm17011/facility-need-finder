import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>vite.close());
const load=path=>vite.ssrLoadModule(path);
const {normalizeRegion,referencesInText}=await load('/frontend/services/geography/regionNormalizer.ts');
const {mapGeographicEvidence}=await load('/frontend/services/geography/geographicMapper.ts');
const {analyzeEvidence}=await load('/frontend/services/evidence/analysis/evidenceAnalyzer.ts');
const {interpretFacility}=await load('/frontend/services/interpretFacility.ts');
const {planEvidenceSearch}=await load('/frontend/services/planEvidenceSearch.ts');
const {normalizeEvidence}=await load('/frontend/services/evidence/evidenceNormalizer.ts');
const {buildQueries}=await load('/frontend/services/evidence/queryBuilder.ts');
const {createDemoProvider}=await load('/backend/evidence/providers/demoProvider.ts');
const profile=await interpretFacility('어린이집');const plan=planEvidenceSearch(profile);const query=buildQueries(profile,plan)[0];
const referenceDate='2026-09-19T12:00:00Z';
// Explicit synthetic test fixtures; never served as application evidence.
function fixture(id,region='용인시',category='PUBLIC_REPORT',overrides={}){
 const item=normalizeEvidence({title:`TEST ONLY ${region} 시설 조사 ${id}`,snippet:'TEST ONLY 조사 대상 500명, 조사 결과 이용 대기 24%, 전년 대비 증가 10%.',url:`https://${id}.example/report`,sourceOrganization:`TEST 기관 ${id}`,sourceLabel:`TEST ${id}`,publishedDate:'2026-06-01',retrievedAt:referenceDate,provider:'test-only',mode:'live'}, {...query,category});
 return {...analyzeEvidence({...item,...overrides},profile,plan,{referenceDate}),...overrides};
}
const pair=(region='용인시')=>[fixture('a',region,'PUBLIC_REPORT'),fixture('b',region,'STATISTICS')];
test('normalization handles exact hierarchies and safe aliases, but never guesses Gwangju or Jung-gu',()=>{
 assert.equal(normalizeRegion('기흥구').displayName,'경기도 용인시 기흥구');
 assert.equal(normalizeRegion('용인').displayName,'경기도 용인시');
 assert.equal(normalizeRegion('광주').normalizationStatus,'ambiguous');
 assert.equal(normalizeRegion('중구').normalizationStatus,'ambiguous');
 assert.equal(normalizeRegion('광주 북구').displayName,'광주광역시 북구');
 assert.equal(normalizeRegion('경기도 광주').displayName,'경기도 광주시');
 assert.equal(normalizeRegion('새로운마을').normalizationStatus,'unknown');
 assert.ok(referencesInText('TEST 광주광역시 북구 보육 조사').some(r=>r.id==='gwangju-buk'));
 assert.equal(referencesInText('광주교육원 소개').length,0);
});
test('specific district maps once, preserving original source and no parent rollup',()=>{
 const input=pair('경기도 용인시 기흥구');const before=structuredClone(input);
 const result=mapGeographicEvidence(input,'live');assert.equal(result.profiles.length,1);
 assert.equal(result.profiles[0].region.displayName,'경기도 용인시 기흥구');assert.equal(result.profiles[0].region.regionCode,null);
 assert.equal(result.candidates.length,1);assert.equal(result.profiles[0].evidenceItems[0].url,input[0].url);assert.deepEqual(input,before);
 assert.ok(result.profiles[0].why.every(reason=>reason.evidenceIds.length&&reason.evidenceIds.every(id=>input.some(i=>i.id===id))));
});
test('province-only evidence is not assigned to a city; national background never boosts regions',()=>{
 const regional=pair('광주광역시');const baseline=mapGeographicEvidence(regional,'live');
 const national=fixture('national','전국','LAW_POLICY',{geographicScope:'NATIONAL',mentionedRegions:[{name:'평택시',regionCode:null}]});
 const result=mapGeographicEvidence([...regional,national],'live');
 assert.equal(result.profiles.length,1);assert.equal(result.profiles[0].region.level2,null);
 assert.equal(result.nationalContext.length,1);assert.equal(result.candidates[0].candidateScore,baseline.candidates[0].candidateScore);
 assert.equal(mapGeographicEvidence([national],'live').candidates.length,0);
});
test('ambiguous, absent, unrelated publisher and contact-address geography do not generate candidates',()=>{
 const unknown=fixture('none','자료','PUBLIC_REPORT',{title:'TEST 자료',snippet:'TEST 소개',mentionedRegions:[],sourceOrganization:'서울특별시 연구기관'});
 const result=mapGeographicEvidence([fixture('ambiguous','중구'),unknown,fixture('address','자료','PUBLIC_REPORT',{title:'TEST 자료 개요',snippet:'주소: 경기도 용인시 기흥구 연락처 정보',mentionedRegions:[]})],'live');
 assert.equal(result.profiles.length,0);assert.equal(result.candidates.length,0);assert.equal(result.unresolved.length,3);
 assert.equal(result.unresolved[0].references[0].normalizationStatus,'ambiguous');
});
test('URL duplicates and same-publisher repetition cannot change candidate score',()=>{
 const input=pair();const baseline=mapGeographicEvidence(input,'live');
 const copies=Array.from({length:20},(_,i)=>({...input[0],id:`repeat-${i}`,title:`TEST 용인시 동일 기관 반복 ${i}`,url:`https://repeated.example.org/report?id=${i}`}));
 const duplicate={...input[1],url:input[1].url+'?utm_source=copy'};
 const result=mapGeographicEvidence([...input,...copies,duplicate],'live');
 assert.equal(result.candidates[0].candidateScore,baseline.candidates[0].candidateScore);
 assert.equal(result.profiles[0].metrics.totalEvidence,22);assert.equal(result.profiles[0].metrics.scoredEvidence,2);
});
test('identical press-release titles from multiple sites are one source group; same-category contributions capped',()=>{
 const press=Array.from({length:20},(_,i)=>fixture(`press${i}`,'용인시','NEWS',{title:'TEST ONLY 용인시 동일 보도자료 제목'}));
 const result=mapGeographicEvidence(press,'live');assert.equal(result.candidates.length,0);assert.equal(result.profiles[0].metrics.scoredSources,1);
 const varied=Array.from({length:20},(_,i)=>fixture(`news${i}`,'용인시','NEWS'));
 assert.equal(mapGeographicEvidence(varied,'live').profiles[0].metrics.scoredEvidence,2);
 const diverse=[fixture('report','용인시','PUBLIC_REPORT'),fixture('stats','용인시','STATISTICS'),fixture('research','용인시','RESEARCH')];
 assert.ok(mapGeographicEvidence(diverse,'live').candidates[0].candidateScore>mapGeographicEvidence(varied,'live').candidates[0].candidateScore);
});
test('insufficient regions have null scores and do not pad TOP 50',()=>{
 const result=mapGeographicEvidence([fixture('one')],'live');assert.equal(result.profiles.length,1);assert.equal(result.profiles[0].candidateScore,null);assert.equal(result.profiles[0].confidence,'INSUFFICIENT');assert.equal(result.candidates.length,0);
 assert.equal(mapGeographicEvidence([...pair(),...pair('평택시').map((item,i)=>({...item,id:`p-${i}`,url:`https://p${i}.example`}))],'live').candidates.length,2);
});
test('unknown directness excluded from mean, confidence conservative, formula traceable',()=>{
 const result=mapGeographicEvidence(pair(),'live').candidates[0];assert.equal(result.dimensions.directEvidence.score,null);assert.equal(result.calculation.weightSum,4);
 assert.equal(result.confidence,'LOW');assert.equal(result.contradiction.status,'unknown');
 assert.equal(result.candidateScore,Math.round(result.calculation.weightedSum/result.calculation.weightSum*10)/10);
 assert.equal(result.calculation.evidenceIds.length,2);
});
test('support and conflict remain in separate sections; strong contradiction reduces confidence, not score',()=>{
 const items=['PUBLIC_REPORT','STATISTICS','RESEARCH','DEMAND_SURVEY'].map((category,i)=>({...fixture(`s${i}`,'용인시',category),evidenceRole:'DIRECT',stance:'SUPPORTS_NEED'}));
 const baseline=mapGeographicEvidence(items,'live').candidates[0];assert.equal(baseline.confidence,'HIGH');
 const contrary=items.map((item,i)=>i===0?{...item,stance:'WEAKENS_NEED'}:item);
 const result=mapGeographicEvidence(contrary,'live').candidates[0];assert.equal(result.supportsNeed.length,3);assert.equal(result.weakensNeed.length,1);assert.equal(result.contradiction.status,'strong');assert.equal(result.confidence,'MEDIUM');assert.equal(result.candidateScore,baseline.candidateScore);
});
test('multi-region documents are not automatically direct proof for every mentioned place',()=>{
 const item={...fixture('multi','용인시 평택시'),evidenceRole:'DIRECT',stance:'SUPPORTS_NEED'};
 const result=mapGeographicEvidence([item],'live');assert.equal(result.profiles.length,2);assert.ok(result.profiles.every(region=>region.dimensions.directEvidence.score===null));
});
test('demo remains isolated and insufficient instead of inventing independent sources',async()=>{
 const [raw]=await createDemoProvider().search(query,new AbortController().signal);
 const item=analyzeEvidence(normalizeEvidence(raw,query),profile,plan,{referenceDate});
 const result=mapGeographicEvidence([item,...pair()],'demo');assert.ok(result.profiles.length>0);assert.equal(result.candidates.length,0);assert.ok(result.profiles.every(region=>region.evidenceItems.every(i=>i.mode==='demo'&&i.url===null)));
});
