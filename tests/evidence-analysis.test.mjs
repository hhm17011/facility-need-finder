import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' });
after(async () => { await vite.close(); });
const load = path => vite.ssrLoadModule(path);
const { interpretFacility } = await load('/frontend/services/interpretFacility.ts');
const { planEvidenceSearch } = await load('/frontend/services/planEvidenceSearch.ts');
const { normalizeEvidence } = await load('/frontend/services/evidence/evidenceNormalizer.ts');
const { buildQueries } = await load('/frontend/services/evidence/queryBuilder.ts');
const { analyzeEvidence, analyzeEvidenceCollection, calculateStrength } = await load('/frontend/services/evidence/analysis/evidenceAnalyzer.ts');
const { selectTopEvidence, sortEvidence, summarizeAnalysis, matchesQuality } = await load('/frontend/services/evidence/analysis/selection.ts');
const { dimensions, defaultWeights } = await load('/frontend/services/evidence/analysis/config.ts');
const { createDemoProvider } = await load('/backend/evidence/providers/demoProvider.ts');
const profile = await interpretFacility('어린이집');
const plan = planEvidenceSearch(profile);
const query = buildQueries(profile, plan)[0];
const options = { referenceDate: '2026-09-19T12:00:00.000Z' };
// Synthetic fixtures only: not fetched, never shipped as real application evidence.
function fixture(overrides = {}) {
 const item = normalizeEvidence({ title:'TEST ONLY · 광주광역시 북구 어린이집 조사', snippet:'TEST ONLY · 조사 대상 500명, 조사 결과 이용 대기 24%, 전년 대비 증가 10%.', url:'https://agency.example.go.kr/report?id=1', sourceOrganization:'TEST ONLY 가상 기관', sourceLabel:'TEST ONLY', publishedDate:'2026-06-01', provider:'test-fixture', mode:'live', retrievedAt:options.referenceDate }, { ...query, category:'PUBLIC_REPORT' });
 return { ...item, ...overrides };
}
const analyze = (item, extra = {}) => analyzeEvidence(item, profile, plan, { ...options, ...extra });

test('strong source metadata gets explained item-level scores, never peer-review or semantic claims', () => {
 const raw = fixture(); const before=structuredClone(raw); const item=analyze(raw);
 assert.equal(item.evaluation.reliability.score,85);
 assert.equal(item.evaluation.relevance.score,null);assert.equal(item.evaluation.relevance.status,'requires_semantic_analysis');
 assert.equal(item.evaluationCompleteness.available,4);assert.equal(item.strengthLabel,'강한 근거');
 assert.equal(item.evidenceRole,'UNKNOWN');assert.equal(item.stance,'UNKNOWN');assert.equal(item.analysisDepth,'search_result_only');
 assert.equal(item.evidenceStrength,(85+100+90+95)/4);
 assert.ok(dimensions.every(key=>item.evaluation[key].reason.length>0));
 assert.match(item.evaluation.reliability.reason,/동료심사는 검증하지 않았습니다/);
 assert.deepEqual(raw,before);assert.equal(item.url,raw.url);assert.deepEqual(item.quantitativeEvidence,raw.quantitativeEvidence);
});
test('same category alone cannot decide strength; domain alone cannot decide reliability',()=>{
 const weak=fixture({title:'자료',snippet:'',sourceOrganization:null,sourceLabel:null,publishedDate:null,mentionedRegions:[],geographicScope:'원문 범위 미확인'});
 const item=analyze(weak);
 assert.equal(item.evaluation.reliability.score,null);assert.equal(item.evidenceStrength,null);assert.equal(item.evaluationCompleteness.available,0);
 assert.equal(item.strengthLabel,'평가 정보 부족');assert.ok(analyze(fixture()).evidenceStrength>0);
 const same={...fixture(),category:'NEWS',categories:['NEWS']};assert.equal(analyze(same).evaluation.reliability.score,analyze(fixture()).evaluation.reliability.score);
});
test('research has a different age horizon than time-sensitive news; law needs current validity',()=>{
 const base=fixture({publishedDate:'2019-01-01',title:'TEST ONLY 시설 접근성 연구',snippet:'TEST ONLY 자료 설명',mentionedRegions:[]});
 const research=analyze({...base,category:'RESEARCH',categories:['RESEARCH']});
 const news=analyze({...base,category:'NEWS',categories:['NEWS']});
 assert.ok(research.evaluation.recency.score>news.evaluation.recency.score);
 const law=analyze({...base,title:'TEST ONLY 설치 조례',category:'LAW_POLICY',categories:['LAW_POLICY']});
 assert.equal(law.evaluation.recency.score,null);assert.equal(law.evaluation.recency.status,'requires_source_verification');
 const recent=analyze({...base,publishedDate:'2026-09-01',category:'NEWS',categories:['NEWS']});assert.equal(recent.evaluation.recency.score,100);
});
test('missing, invalid and future publication dates are not replaced with discovery dates',()=>{
 for(const publishedDate of [null,'bad','2026-02-30','2027-01-01']) {
  const item=analyze(fixture({publishedDate,providerDateHint:'2026-09-18'}));
  assert.equal(item.evaluation.recency.score,null);assert.equal(item.evaluation.recency.status,'unknown');
  assert.equal(item.evaluationCompleteness.available,3);assert.equal(item.strengthLabel,'보조 근거');
  assert.equal(item.strengthCalculation.weightSum,3);
  assert.equal(item.evidenceStrength,Math.round((80+90+95)/3*10)/10);
 }
});
test('local, provincial, national and unknown geography are distinguished, without claims of demand',()=>{
 const make=title=>analyze(fixture({title,snippet:'TEST ONLY 자료의 개요',mentionedRegions:[]}));
 assert.equal(make('TEST ONLY 광주광역시 북구 보육 조사').regionalLevel,'local');
 assert.equal(make('TEST ONLY 광주광역시 보육 조사').regionalLevel,'provincial');
 assert.equal(make('TEST ONLY 전국 보육 현황').regionalLevel,'national');
 assert.equal(make('TEST ONLY 보육 개요').evaluation.regionalSpecificity.score,null);
 assert.equal(make('TEST ONLY 전국 보육 현황').evidenceRole,'UNKNOWN');
 assert.match(make('TEST ONLY 광주광역시 북구 보육 조사').evaluation.regionalSpecificity.reason,/직접 입증했다는 뜻은 아닙니다/);
});
test('specificity uses actual values, not years or numbers invented by the analyzer',()=>{
 const base=fixture({title:'TEST ONLY 자료 개요',snippet:'2026년 연구 자료를 소개합니다.'});
 const item=analyze(base);assert.equal(item.evaluation.specificity.score,15);
 assert.ok(!item.evaluation.specificity.signals.some(s=>s.includes('관찰된 수량')));
 const specific=analyze(fixture());assert.ok(specific.evaluation.specificity.signals.some(s=>s.includes('500명')));
 assert.deepEqual(specific.quantitativeEvidence,[]);
});
test('unknown is omitted, actual zero is included, weights are transparent and replaceable',()=>{
 const evals=analyze(fixture()).evaluation;
 const result=calculateStrength({...evals,reliability:{...evals.reliability,score:0}},defaultWeights);
 assert.equal(result.evaluationCompleteness.available,4);assert.equal(result.strengthCalculation.weightSum,4);assert.equal(result.evidenceStrength,71.3);
 const weighted=calculateStrength(evals,{...defaultWeights,reliability:2});
 assert.equal(weighted.evidenceStrength,(85*2+100+90+95)/5);assert.equal(weighted.strengthCalculation.method,'configured_available_mean');
 const noWeights=calculateStrength(evals,Object.fromEntries(dimensions.map(key=>[key,0])));assert.equal(noWeights.evidenceStrength,null);
});
test('duplicate sources are evaluated once and preserve URL and merged categories',()=>{
 const first=fixture();const duplicate={...first,url:first.url+'&utm_source=another',category:'RESEARCH',categories:['RESEARCH']};
 const items=analyzeEvidenceCollection([first,duplicate],profile,plan,options);
 assert.equal(items.length,1);assert.equal(items[0].url,first.url);assert.deepEqual(items[0].categories,['PUBLIC_REPORT','RESEARCH']);
});
test('opposing source content remains visible and is not forced to support construction',()=>{
 const support=fixture();const contrary=fixture({id:'test-contrary',url:'https://example.org/contrary',title:'TEST ONLY 어린이집 이용 감소와 충분한 공급',snippet:'TEST ONLY 조사 대상 500명, 조사 결과 이용 감소 30%, 전년 대비 감소.'});
 const items=analyzeEvidenceCollection([support,contrary],profile,plan,options);
 assert.equal(items.length,2);assert.ok(items.every(item=>item.stance==='UNKNOWN'));assert.ok(items.some(item=>item.snippet.includes('감소')));
 assert.ok(plan.evidenceCategories.find(c=>c.type==='NEWS').searchTopics.some(topic=>topic.includes('감소')));
});
test('semantic boundary receives profile and plan, accepts only grounded judgments and preserves opposing stances',()=>{
 const adapter=({evidence,facility,plan:searchPlan})=>{
  assert.equal(facility.facilityName,profile.facilityName);assert.equal(searchPlan.facility,plan.facility);
  return {relevance:{score:90,status:'evaluated',reason:'TEST ONLY grounded semantic fixture',method:'semantic',signals:[]},evidenceRole:'DIRECT',roleReason:'TEST ONLY 직접 근거 판정',stance:'WEAKENS_NEED',stanceReason:'TEST ONLY 수요 약화 판정',supportingPassages:[{field:'snippet',quote:evidence.snippet}]};
 };
 const item=analyze(fixture(),{semanticAnalyzer:adapter});assert.equal(item.stance,'WEAKENS_NEED');assert.equal(item.evidenceRole,'DIRECT');assert.equal(item.evaluationCompleteness.available,5);
 assert.equal(summarizeAnalysis([item]).directRegional,1);assert.equal(matchesQuality(item,'direct'),true);
 const invalid=analyze(fixture(),{semanticAnalyzer:()=>({...adapter({evidence:fixture(),facility:profile,plan}),supportingPassages:[{field:'snippet',quote:'Invented quote'}]})});
 assert.equal(invalid.evaluation.relevance.score,null);assert.equal(invalid.evidenceRole,'UNKNOWN');
 const failed=analyze(fixture(),{semanticAnalyzer:()=>{throw Error('test');}});assert.equal(failed.evaluation.relevance.score,null);
});
test('demo evaluation is clearly marked, does not invent missing dates or URLs',async()=>{
 const provider=createDemoProvider();const [raw]=await provider.search(query,new AbortController().signal);
 const item=analyze(normalizeEvidence(raw,query));
 assert.equal(item.mode,'demo');assert.match(item.title,/DEMO/);assert.equal(item.url,null);assert.equal(item.evaluation.recency.score,null);assert.equal(item.strengthLabel,'평가 정보 부족');
});
test('strength, newest and category sorting work without removing unknown or conflicting sources',()=>{
 const strong=analyze(fixture());const news=analyze(fixture({id:'test-news',url:'https://example.org/news',category:'NEWS',categories:['NEWS'],publishedDate:'2026-09-18',snippet:'TEST ONLY 최근 현황을 설명합니다.'}));
 const unknown=analyze(fixture({id:'test-unknown',url:'https://example.org/unknown',publishedDate:null}));
 assert.equal(sortEvidence([news,strong,unknown],'strength')[0].id,strong.id);
 assert.equal(sortEvidence([unknown,strong,news],'newest')[0].id,news.id);
 assert.equal(sortEvidence([unknown,strong,news],'newest').at(-1).id,unknown.id);
 assert.equal(sortEvidence([news,strong],'category')[0].category,'PUBLIC_REPORT');
 assert.equal(matchesQuality(strong,'strong'),true);assert.equal(matchesQuality(strong,'regional'),true);assert.equal(matchesQuality(strong,'direct'),false);
});
test('Top Evidence enforces quality and completeness before diversity and does not pad weak categories',()=>{
 const make=(id,category,score,available=4)=>({...analyze(fixture()),id,category,categories:[category],evidenceStrength:score,evaluationCompleteness:{available,total:5}});
 const top=selectTopEvidence([make('a','PUBLIC_REPORT',95),make('b','PUBLIC_REPORT',94),make('c','RESEARCH',92),make('d','NEWS',30),make('e','NEWS',99,1)]);
 assert.deepEqual(top.map(i=>i.id),['a','c','b']);assert.equal(selectTopEvidence([make('d','NEWS',30)]).length,0);
 const many=Array.from({length:8},(_,i)=>make(String(i),'PUBLIC_REPORT',90-i));assert.equal(selectTopEvidence(many).length,5);
});
