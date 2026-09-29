import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>vite.close());
const load=p=>vite.ssrLoadModule(p);
const {KosisClient}=await load('/backend/dataProviders/kosis/kosisClient.ts');
const {KosisProvider}=await load('/backend/dataProviders/kosis/KosisProvider.ts');
const {populationTable,KosisTableRegistry}=await load('/backend/dataProviders/kosis/kosisTables.ts');
const {normalizeKosisRows,parsePopulation,resolveKosisRegion}=await load('/backend/dataProviders/kosis/kosisNormalizer.ts');
const {regionalEvidenceEngine}=await load('/frontend/services/regional/engine.ts');
const {populationTimeSeries,populationRequirement,populationPhenomena}=await load('/frontend/services/dataProviders/population.ts');
const {interpretFacility}=await load('/frontend/services/interpretFacility.ts');
// Explicit TEST ONLY fixtures. These are not real KOSIS observations or LIVE validation.
const table=populationTable;
const metadata={table:[{TBL_NM:table.name}],organization:[{ORG_NM:'TEST ONLY'}],periods:[{PRD_SE:'Y',PRD_DE:'2024'},{PRD_SE:'Y',PRD_DE:'2025'}],classifications:[{OBJ_ID:'ITEM',ITM_ID:'TEST-TOTAL',ITM_NM:'총인구수'},{OBJ_ID:'TEST-REGION',OBJ_ID_SN:'1',ITM_ID:'TEST-GG',ITM_NM:'경기도'},{OBJ_ID:'TEST-REGION',OBJ_ID_SN:'1',ITM_ID:'TEST-YI',ITM_NM:'용인시',UP_ITM_ID:'TEST-GG'},{OBJ_ID:'TEST-REGION',OBJ_ID_SN:'1',ITM_ID:'TEST-SEOUL',ITM_NM:'서울특별시'},{OBJ_ID:'TEST-REGION',OBJ_ID_SN:'1',ITM_ID:'TEST-JUNG',ITM_NM:'중구',UP_ITM_ID:'TEST-SEOUL'}],units:[{UNIT_NM:'명'}]};
const row=(patch={})=>({ORG_ID:'101',TBL_ID:table.tableId,TBL_NM:table.name,PRD_SE:'Y',PRD_DE:'2025',C1:'TEST-YI',C1_NM:'용인시',ITM_ID:'TEST-TOTAL',ITM_NM:'총인구수',UNIT_NM:'명',DT:'1,000',...patch});
const normalize=(rows=[row()])=>normalizeKosisRows(rows,table,metadata,'2026-09-20T00:00:00Z','TEST-TOTAL','Y',['2024','2025']);
const response=data=>new Response(JSON.stringify(data));
function fixtureClient(){
 const urls=[];
 const fetcher=async url=>{urls.push(String(url));const q=url.searchParams;const types={TBL:'table',ORG:'organization',PRD:'periods',ITM:'classifications',UNIT:'units'};return response(q.get('method')==='getMeta'?metadata[types[q.get('type')]]:[row({PRD_DE:'2024',DT:'900'}),row()]);};
 return {client:new KosisClient('TEST-SECRET',fetcher,300000,0),urls};
}
test('numeric parsing: null is not zero, symbols/fractions/negative/nonfinite rejected',()=>{
 for(const value of [null,undefined,'',' ','-','...','X','1,00','-1','1.5','Infinity',{},false])assert.equal(parsePopulation(value),null);
 assert.equal(parsePopulation('0'),0);assert.equal(parsePopulation('1,234'),1234);
});
test('normalization retains raw provenance; provider code never becomes official code',()=>{
 const m=normalize()[0];assert.equal(m.regionId,'yongin');assert.equal(m.regionCode,null);assert.equal(m.regionName,'경기도 용인시');assert.equal(m.administrativeLevel,'SIGUNGU');assert.equal(m.value,1000);assert.equal(m.unit,'명');assert.equal(m.referenceDate,'2025');assert.equal(m.structuredSource.providerRegionCode,'TEST-YI');assert.deepEqual(m.structuredSource.rawSource,row());assert.equal(m.comparable,false);assert.equal(m.boundaryVersion,null);
});
test('parent metadata resolves Jung-gu; missing/conflicting parents never guess',()=>{
 const scoped=resolveKosisRegion(row({C1:'TEST-JUNG',C1_NM:'중구'}),metadata);assert.equal(scoped.region.id,'sigungu:11140');
 const ambiguous=normalize([row({C1:'missing',C1_NM:'중구'})])[0];assert.equal(ambiguous.regionId,null);assert.equal(ambiguous.structuredSource.normalizationStatus,'AMBIGUOUS');
 const unknown=normalize([row({C1:'new',C1_NM:'알수없는시'})])[0];assert.equal(unknown.regionId,null);
 const dong=normalize([row({C1:'dong',C1_NM:'용인시 기흥구 보정동'})])[0];assert.equal(dong.administrativeLevel,'EUPMYEONDONG');assert.equal(dong.regionId,null);
 const mismatch=structuredClone(metadata);mismatch.classifications.find(r=>r.ITM_ID==='TEST-GG').ITM_NM='서울특별시';assert.equal(resolveKosisRegion(row(),mismatch).region.id,null);
});
test('missing values/region/unit retained with verification withheld',()=>{
 for(const patch of [{DT:'-'},{C1:''},{C1_NM:''},{UNIT_NM:'천명'}])assert.equal(normalize([row(patch)])[0].verification,'unverified');
 assert.equal(normalize([row({DT:'-'})])[0].value,null);assert.equal(normalize([row({DT:'0'})])[0].value,0);
});
test('reject mismatched table/period/item and unexpected dimensions',()=>{
 for(const patch of [{TBL_ID:'WRONG'},{TBL_NM:'WRONG'},{ORG_ID:'0'},{PRD_DE:'2099'},{PRD_SE:'M'},{ITM_ID:'OTHER'},{ITM_NM:'남자인구수'},{C2:'extra'}])assert.throws(()=>normalize([row(patch)]));
});
test('provider metadata-driven items and periods, table-level batching, cache and cloning',async()=>{
 const {client,urls}=fixtureClient();const p=new KosisProvider(client);const [a,b]=await Promise.all([p.getPopulation(),p.getPopulation()]);
 assert.equal(a.metrics.length,2);assert.equal(urls.length,6);assert.ok(urls.every(url=>url.startsWith('https://kosis.kr/')));assert.equal(new URL(urls.at(-1)).searchParams.get('objL1'),'ALL');assert.equal(new URL(urls.at(-1)).searchParams.get('itmId'),'TEST-TOTAL');
 a.metrics[0].value=-100;assert.equal(b.metrics[0].value,900);assert.equal((await p.getPopulation()).metrics[0].value,900);assert.equal(urls.length,6);assert.equal((await p.getPopulationByAge()).status,'NOT_CONFIGURED');
 await assert.rejects(p.getPopulation({periods:['2099']}),e=>e.code==='MISSING_PERIOD');
});
test('missing key, API error, HTML, malformed, empty, HTTP auth and timeout sanitized',async()=>{
 await assert.rejects(new KosisClient('').request('statisticsData.do',{}),e=>e.code==='MISSING_KEY');
 for(const [body,code] of [[{err:'20',errMsg:'TEST-SECRET'},'API_ERROR'],[[], 'EMPTY_RESPONSE'],[{hello:'world'},'INVALID_RESPONSE']])await assert.rejects(new KosisClient('TEST-SECRET',async()=>response(body),0,0).request('statisticsData.do',{}),e=>e.code===code&&!e.message.includes('TEST-SECRET'));
 await assert.rejects(new KosisClient('secret',async()=>new Response('<html>'),0,0).request('statisticsData.do',{}),e=>e.code==='INVALID_RESPONSE');
 await assert.rejects(new KosisClient('secret',async()=>new Response('',{status:401}),0,0).request('statisticsData.do',{}),e=>e.code==='INVALID_KEY');
 await assert.rejects(new KosisClient('secret',async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('secret')))),0,0,5).request('statisticsData.do',{}),e=>e.code==='TIMEOUT'&&!e.message.includes('secret'));
});
test('cache key includes table/period/items/classification; expiry retries and failed responses not cached',async()=>{
 let count=0;const c=new KosisClient('secret',async()=>{count++;return response([{ok:true}]);},5,0);
 for(const params of [{tblId:'a',itmId:'a',objL1:'a',prdSe:'Y'},{tblId:'b'},{tblId:'a',itmId:'b'},{tblId:'a',objL1:'b'},{tblId:'a',prdSe:'M'}])await c.request('statisticsData.do',params);
 assert.equal(count,5);await new Promise(resolve=>setTimeout(resolve,8));await c.request('statisticsData.do',{tblId:'b'});assert.equal(count,6);
 let failures=0;const bad=new KosisClient('secret',async()=>{failures++;return response({err:'failure'});},1000,0);for(let i=0;i<2;i++)await assert.rejects(bad.request('statisticsData.do',{}));assert.equal(failures,2);
});
test('additional table registration explicit; discovery cannot auto-register',()=>{
 const registry=new KosisTableRegistry();registry.register({...table,id:'TEST-ONLY',tableId:'TEST-ONLY'});assert.equal(registry.list().length,3);assert.throws(()=>registry.register(table));assert.throws(()=>registry.get('unreviewed'));
});
test('time series blocks unknown boundaries and zero denominator; compatible series retains inputs/formula',async()=>{
 const metrics=normalize([row({PRD_DE:'2024',DT:'900'}),row()]);assert.equal(populationTimeSeries(metrics)[0].change,null);
 const compatible=metrics.map(m=>({...m,boundaryVersion:'TEST VERIFIED SAME BOUNDARY',limitations:[]}));const change=populationTimeSeries(compatible)[0].change;assert.equal(change.absolute,100);assert.ok(Math.abs(change.percentage-100/900*100)<0.001);assert.equal(change.sourceMetrics.length,2);
 assert.equal(populationTimeSeries([{...compatible[0],value:0},compatible[1]])[0].change,null);
 assert.ok(populationTimeSeries([{...compatible[0],unit:'천명'},compatible[1]]).every(s=>!s.change));
 const profile=await interpretFacility('어린이집');const phenomena=populationPhenomena(compatible,profile);assert.equal(phenomena.length,1);assert.ok(phenomena[0].description.includes('시설 공급 데이터 필요'));assert.equal(populationRequirement(profile).ageRange,null);assert.deepEqual(populationRequirement(profile,{'어린이집':{targetPopulationType:'TEST',ageRange:[0,5]}}).ageRange,[0,5]);
});
test('engine receives structured facts but population alone yields no issue signal, eligibility or rank; DEMO isolated',async()=>{
 const facility=await interpretFacility('어린이집');const issue={id:'TEST',title:'TEST ONLY',issueType:'SPATIAL_MISMATCH',evidenceIds:[],relatedRegions:[],conflictingEvidenceIds:[]};
 const args={facility,issue,items:[],mode:'live',structuredMetrics:normalize()};const result=regionalEvidenceEngine(args);assert.equal(result.metrics.length,1);assert.equal(result.profiles.length,1);assert.equal(result.supportedRegions.length,0);assert.equal(result.profiles[0].candidateScore,null);assert.equal(result.profiles[0].regionalAssessment.evidenceCoverage.DEMOGRAPHIC_CHANGE.status,'partial');assert.ok(result.evidenceLinks.some(l=>l.dataKind==='STRUCTURED_REGIONAL_DATA'));
 assert.equal(regionalEvidenceEngine({...args,mode:'demo'}).metrics.length,0);
 assert.equal(regionalEvidenceEngine({...args,structuredMetrics:args.structuredMetrics.map(m=>({...m,structuredSource:{...m.structuredSource,mode:'demo'}}))}).profiles.length,0);
});
