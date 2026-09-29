import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>vite.close());
const load=p=>vite.ssrLoadModule(p);
const {regionalEvidenceEngine}=await load('/frontend/services/regional/engine.ts');
const {administrativeLevel}=await load('/frontend/services/regional/administrative.ts');
const {regionalRequirements,regionalQueries}=await load('/frontend/services/regional/requirements.ts');
const {extractRegionalMetrics,compareRegionalMetrics,deriveFacilityPerThousand}=await load('/frontend/services/regional/metrics.ts');
const {interpretFacility}=await load('/frontend/services/interpretFacility.ts');
const {planEvidenceSearch}=await load('/frontend/services/planEvidenceSearch.ts');
const {normalizeEvidence}=await load('/frontend/services/evidence/evidenceNormalizer.ts');
const {analyzeEvidence}=await load('/frontend/services/evidence/analysis/evidenceAnalyzer.ts');
const {buildQueries}=await load('/frontend/services/evidence/queryBuilder.ts');
const {joinSidoEvidence}=await load('/frontend/services/geography/boundaries/koreaSido.ts');
const {normalizeRegion}=await load('/frontend/services/geography/regionNormalizer.ts');
const facility=await interpretFacility('어린이집');const plan=planEvidenceSearch(facility);const query=buildQueries(facility,plan)[0];
const issue={id:'test-issue',title:'TEST ONLY 지역 분포와 인구 변화',issueType:'SPATIAL_MISMATCH',evidenceIds:[],conflictingEvidenceIds:[],relatedRegions:[],mode:'live'};
function fixture(id,quote='용인시 어린이집 이용 대상 인구가 변화하고 시설 분포와 생활권의 불일치를 조사했다.',overrides={}){
 const item=normalizeEvidence({title:`TEST ONLY ${id} 지역 자료`,snippet:quote,url:`https://${id}.example/report`,sourceOrganization:`TEST ${id}`,publishedDate:'2026-06-01',retrievedAt:'2026-09-20T12:00:00Z',provider:'test-only',mode:'live'},query);
 const evaluated=analyzeEvidence(item,facility,plan);return {...evaluated,category:'PUBLIC_REPORT',categories:['PUBLIC_REPORT'],extractedClaims:[{text:quote,sourceExcerpt:quote,sourceLocator:'TEST 문단'}],evaluation:{...evaluated.evaluation,relevance:{score:90,status:'evaluated',reason:'TEST ONLY 명시 평가',method:'semantic',signals:[]}},evaluationCompleteness:{available:5,total:5},evidenceStrength:90,evidenceRole:'DIRECT',stance:'SUPPORTS_NEED',...overrides};
}
const run=(items,patch={})=>regionalEvidenceEngine({facility,issue:{...issue,evidenceIds:items.map(i=>i.id)},items,mode:'live',...patch});
const region=r=>r.profiles.find(p=>p.region.id==='yongin');
function observation(regionName='용인시',overrides={}){return {metricId:'population',metricType:'target_population',dimension:'DEMOGRAPHIC_CHANGE',regionName,administrativeLevel:'SIGUNGU',value:1000,unit:'명',referenceDate:'2025',definition:'등록 이용 대상 인구',populationDefinition:'0-5세 등록인구',denominator:'NOT_APPLICABLE',boundaryVersion:'2025-01-01',sourceExcerpt:`${regionName} 어린이집 이용 대상 인구 1000명 2025년`,sourceLocator:'TEST 표 1',verification:'source_verified',...overrides};}
test('A/C: SIDO/national context never promotes mentioned child; signal N/A and map neutral',()=>{
 const mention=fixture('mention','용인시 어린이집 자료 소개',{extractedClaims:[],category:'NEWS'});
 const parent=fixture('parent','경기도 어린이집 인구 증가 통계',{geographicScope:'경기도'});
 const national=fixture('national','전국 어린이집 공급 변화',{geographicScope:'NATIONAL'});
 const result=run([mention,parent,national]);assert.equal(result.supportedRegions.length,0);assert.equal(region(result).candidateScore,null);assert.equal(region(result).regionalAssessment.status,'INSUFFICIENT');assert.ok(region(result).regionalAssessment.parentContextEvidenceIds.includes(parent.id));assert.ok(region(result).regionalAssessment.nationalContextEvidenceIds.includes(national.id));
 const misleading=fixture('wide','경기도 어린이집 인구 증가. 용인시에서 관련 회의를 개최했다.',{geographicScope:'경기도'});assert.equal(run([misleading]).supportedRegions.length,0);
 assert.equal(run([national]).supportedRegions.length,0);
});
test('B: one explicitly verified SIGUNGU statistic suffices for partial support without fabricated complete coverage',()=>{
 const item=fixture('stat','용인시 어린이집 통계',{extractedClaims:[],regionalObservations:[observation()],category:'STATISTICS'});const result=run([item]);assert.equal(result.supportedRegions.length,1);const p=region(result);assert.equal(p.regionalAssessment.status,'PARTIALLY_SUPPORTED');assert.ok(p.regionalAssessment.directEvidenceIds.includes(item.id));assert.equal(p.regionalAssessment.coverageCount,1);assert.ok(p.regionalAssessment.dataGaps.length);assert.equal(p.confidence,'LOW');assert.ok(p.candidateScore!==null);
});
test('D: article mention and unresolved relevance only discover; no arbitrary map candidate',()=>{
 const mention=fixture('news','용인시 어린이집 이름을 소개한 기사',{category:'NEWS',extractedClaims:[]});assert.equal(run([mention]).supportedRegions.length,0);
 const weak=fixture('weak',undefined,{evaluationCompleteness:{available:1,total:5}});assert.equal(run([weak]).supportedRegions.length,0);
});
test('E/F: multiple independent direct dimensions supported; opposing strong sources remain CONFLICTING',()=>{
 const a=fixture('a');const b=fixture('b',undefined,{category:'STATISTICS'});const supported=region(run([a,b]));assert.equal(supported.regionalAssessment.status,'SUPPORTED');
 const c=fixture('c','용인시 어린이집 이용 대상 인구가 감소하고 기존 시설 이용률이 낮다.',{stance:'WEAKENS_NEED'});const conflicting=region(run([a,b,c]));assert.equal(conflicting.regionalAssessment.status,'CONFLICTING');assert.ok(conflicting.regionalAssessment.conflictingEvidenceIds.includes(c.id));assert.equal(conflicting.confidence,'LOW');assert.ok(conflicting.regionalAssessment.eligible);
});
test('G/H: year/unit/definition/denominator/admin grain incompatible → no comparison',()=>{
 const first=fixture('a',undefined,{regionalObservations:[observation()]});
 for(const patch of [{referenceDate:'2021'},{unit:'개소'},{definition:'다른 정의'},{denominator:'전체 인구'},{populationDefinition:'6-12세'},{boundaryVersion:'2020'}, {regionName:'용인시 기흥구',sourceExcerpt:'용인시 기흥구 인구 1000명',administrativeLevel:'SIGUNGU'}]){
  const second=fixture('b',undefined,{regionalObservations:[observation('평택시',patch)]});const compared=compareRegionalMetrics(extractRegionalMetrics([first,second]));assert.equal(compared.comparisonGroups.length,0);assert.ok(compared.metrics.every(m=>!m.comparable));if(patch.referenceDate)assert.ok(compared.metrics.some(m=>m.limitations.some(l=>l.includes('기준연도'))));
 }
 const equal=fixture('equal',undefined,{regionalObservations:[observation('평택시')]});assert.equal(compareRegionalMetrics(extractRegionalMetrics([first,equal])).comparisonGroups.length,1);
});
test('derived indicators retain formula and inputs, refuse zero/missing/incompatible/unverified inputs',()=>{
 const item=fixture('a',undefined,{regionalObservations:[observation(),observation('용인시',{metricId:'count',metricType:'facility_count',dimension:'FACILITY_CHANGE',value:10,unit:'개소',definition:'등록 어린이집 개소 수',sourceExcerpt:'용인시 어린이집 10개소'})]});
 const [p,f]=extractRegionalMetrics([item]);const derived=deriveFacilityPerThousand(p,f);assert.equal(derived.result,10);assert.equal(derived.inputs.length,2);assert.deepEqual(derived.sourceEvidenceIds,[item.id]);assert.equal(deriveFacilityPerThousand(p,{...f,referenceDate:'2020'}),null);assert.equal(deriveFacilityPerThousand({...p,value:0},f),null);assert.equal(deriveFacilityPerThousand(p,{...f,value:null}),null);
 const falseRow=extractRegionalMetrics([fixture('bad',undefined,{regionalObservations:[observation('용인시',{value:9000})]})])[0];assert.ok(falseRow.limitations.some(l=>l.includes('원문 발췌')));assert.equal(deriveFacilityPerThousand(falseRow,f),null);
});
test('administrative resolution never collapses dong into district and broader city into its gu',()=>{
 assert.equal(administrativeLevel('기흥구 보정동'),'EUPMYEONDONG');assert.equal(administrativeLevel('용인시 기흥구'),'SIGUNGU');assert.equal(administrativeLevel('경기도'),'SIDO');
 const dong=fixture('dong','용인시 기흥구 보정동 어린이집 인구 이동과 시설 분포 변화');assert.equal(run([dong]).supportedRegions.length,0);
 const gu=fixture('mention','용인시 기흥구 어린이집 소개',{extractedClaims:[]});const city=fixture('city','용인시 어린이집 인구와 시설 분포 변화',{geographicScope:'용인시'});const result=run([gu,city]);const district=result.profiles.find(p=>p.region.id==='yongin-giheung');assert.equal(district.candidateScore,null);assert.ok(district.regionalAssessment.parentContextEvidenceIds.includes(city.id));
});
test('I/J: only validated profiles can affect real polygon join; context-only region neutral',()=>{
 const result=run([fixture('mention','용인시 어린이집 기사',{extractedClaims:[]})]);const feature={properties:{shapeISO:'KR-41'}};const joined=joinSidoEvidence(feature,result.profiles);assert.equal(joined.evidenceCount,0);assert.equal(joined.colorSignal,null);assert.equal(joined.regionalStatus,'NEUTRAL');
});
test('requirements and staged queries depend on issue/facility, bounded and neutral/opposing',async()=>{
 const senior=await interpretFacility('노인복지관');const a=regionalRequirements(facility,issue);const b=regionalRequirements(senior,{...issue,issueType:'ADAPTIVE_REUSE_OPPORTUNITY'});assert.notDeepEqual(a.filter(r=>r.importance==='required').map(r=>r.dimension),b.filter(r=>r.importance==='required').map(r=>r.dimension));
 assert.ok(regionalQueries(senior,'ADAPTIVE_REUSE_OPPORTUNITY','discovery').every(q=>q.query.includes('노인복지관')));assert.ok(regionalQueries(facility,issue.issueType,'discovery').some(q=>/과잉|감소|충분/.test(q.query)));assert.equal(regionalQueries(facility,issue.issueType,'discovery').length,6);assert.equal(regionalQueries(facility,issue.issueType,'validation',normalizeRegion('용인시')).length,3);
});
test('repeated sources do not dominate, no top50 padding, original evidence remains unchanged',()=>{
 const a=fixture('a');const b=fixture('b',undefined,{category:'STATISTICS'});const baseline=run([a,b]);const copies=Array.from({length:20},(_,n)=>({...a,id:`copy${n}`,url:`https://a.example/${n}`}));const input=[a,b,...copies];const before=structuredClone(input);const result=run(input);assert.equal(region(result).candidateScore,region(baseline).candidateScore);assert.deepEqual(input,before);assert.equal(run([]).supportedRegions.length,0);
});
test('original quantitative fields survive as unverified metrics; missing definitions are not invented',()=>{
 const item=fixture('legacy',undefined,{quantitativeEvidence:[{indicator:'등록 인구',value:1000,unit:'명',referencePeriod:'2025',geographicScope:'용인시',sourceExcerpt:'용인시 등록 인구 1000명',sourceLocator:'표 1'}]});
 const rows=extractRegionalMetrics([item]);assert.equal(rows[0].value,1000);assert.equal(rows[0].definition,null);assert.equal(rows[0].verification,'unverified');assert.equal(compareRegionalMetrics(rows).comparisonGroups.length,0);
});
test('conflicting numeric rows remain visible as CONFLICTING; invalid dates cannot compare',()=>{
 const a=fixture('numa',undefined,{extractedClaims:[],regionalObservations:[observation()]});
 const b=fixture('numb',undefined,{extractedClaims:[],regionalObservations:[observation('용인시',{value:1100,sourceExcerpt:'용인시 어린이집 이용 대상 인구 1100명 2025년'})]});
 const result=run([a,b]);const r=region(result);assert.equal(r.regionalAssessment.status,'CONFLICTING');assert.ok(r.regionalAssessment.conflictingEvidenceIds.includes(a.id));assert.ok(r.regionalAssessment.conflictingEvidenceIds.includes(b.id));assert.equal(result.comparisonGroups.length,0);
 const invalid=extractRegionalMetrics([fixture('invalid',undefined,{regionalObservations:[observation('용인시',{referenceDate:'2025-13'})]})]);assert.ok(invalid[0].limitations.some(l=>l.includes('시점 형식')));
});
test('an explicit verified local row in a national dataset is local evidence, without distributing the national total',()=>{
 const national=fixture('national-table','전국 어린이집 통계표',{geographicScope:'NATIONAL',extractedClaims:[],regionalObservations:[observation()]});const result=run([national]);assert.equal(result.supportedRegions.length,1);assert.equal(result.supportedRegions[0].region.id,'yongin');assert.ok(result.evidenceLinks.some(l=>l.administrativeLevel==='NATIONAL'));assert.ok(result.evidenceLinks.some(l=>l.administrativeLevel==='SIGUNGU'));
});
test('multi-region mentions keep discovery provenance without splitting a claim into direct regional facts',()=>{
 const item=fixture('multi','용인시와 평택시 어린이집 인구와 시설 분포를 소개한다.');const result=run([item]);assert.equal(result.supportedRegions.length,0);assert.equal(result.profiles.length,2);assert.ok(result.profiles.every(p=>p.evidenceItems.some(i=>i.id===item.id)));assert.ok(result.profiles.every(p=>p.regionalAssessment.links.some(l=>l.evidenceId===item.id&&l.geographicEvidenceRole==='UNKNOWN')));
});
