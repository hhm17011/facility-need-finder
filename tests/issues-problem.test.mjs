import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite=await createServer({configFile:false,server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>vite.close());
const load=p=>vite.ssrLoadModule(p);
const {analyzeIssues}=await load('/frontend/services/issues/analyzeIssues.ts');
const {generateProblemDefinition,editSection,regenerateSection}=await load('/frontend/services/problemDefinition/generator.ts');
const {extractClaims}=await load('/frontend/services/problemDefinition/claims.ts');
const {interpretFacility}=await load('/frontend/services/interpretFacility.ts');
const {planEvidenceSearch}=await load('/frontend/services/planEvidenceSearch.ts');
const {analyzeEvidence}=await load('/frontend/services/evidence/analysis/evidenceAnalyzer.ts');
const {normalizeEvidence}=await load('/frontend/services/evidence/evidenceNormalizer.ts');
const {buildQueries}=await load('/frontend/services/evidence/queryBuilder.ts');
const {mapGeographicEvidence}=await load('/frontend/services/geography/geographicMapper.ts');
const {mapIssueEvidence}=await load('/frontend/services/issues/mapIssueEvidence.ts');
const {createDemoProvider}=await load('/backend/evidence/providers/demoProvider.ts');
const profile=await interpretFacility('어린이집');const plan=planEvidenceSearch(profile);const query=buildQueries(profile,plan)[0];
const now='2026-09-20T12:00:00Z';
const text='용인시에서 이용자 인구의 이동이 관찰된다. 용인시에서 기존 시설 분포와 생활권의 불일치가 관찰된다.';
// TEST ONLY: explicitly annotated extracted passages, never supplied as LIVE app results.
function fixture(id,passage=text,overrides={}){
 const item=normalizeEvidence({title:`TEST ONLY 용인시 시설 보고서 ${id}`,snippet:passage,url:`https://${id}.example/report`,sourceOrganization:`TEST ${id}`,publishedDate:'2026-06-01',retrievedAt:now,provider:'test-only',mode:'live'},query);
 const evaluated=analyzeEvidence(item,profile,plan,{referenceDate:now});
 return {...evaluated,extractedClaims:[{text:passage,sourceExcerpt:passage,sourceLocator:'TEST 문단 1'}],evaluation:{...evaluated.evaluation,relevance:{score:90,status:'evaluated',reason:'TEST ONLY 명시 평가',method:'semantic',signals:[]}},evaluationCompleteness:{available:5,total:5},evidenceStrength:90,evidenceRole:'DIRECT',stance:'SUPPORTS_NEED',...overrides};
}
function input(items,facility=profile){const analysis=analyzeIssues(items,facility,'live');assert.ok(analysis.issues.length);return {facility,issue:analysis.issues[0],region:mapGeographicEvidence(items,'live').profiles[0]??null,nationalContext:[],mode:'live',referenceDate:now};}
test('four facility plans cover phenomena; issue patterns derive from evidence, not shortage templates',async()=>{
 const scenarios=[['어린이집',text,'SPATIAL_MISMATCH'],['노인복지관','용인시에서 이용자 인구가 감소한다. 용인시에서 유휴 시설의 재사용과 생활권 연결을 함께 검토한다.','ADAPTIVE_REUSE_OPPORTUNITY'],['청소년 문화시설','용인시에서 이용자의 활동 요구가 변화한다. 용인시에서 활동 요구와 기존 시설 공간 구성의 불일치가 관찰된다.','PROGRAM_MISMATCH'],['도서관','용인시에서 이용자 인구가 이동한다. 용인시에서 이용자 이동과 시설 접근성의 격차가 관찰된다.','ACCESSIBILITY_GAP']];
 for(const [name,passage,type] of scenarios){const p=await interpretFacility(name);const plan=planEvidenceSearch(p);assert.ok(plan.phenomenonTopics.length>=7);assert.ok(buildQueries(p,plan).some(q=>/변화|접근|분포/.test(q.query)));const result=analyzeIssues([fixture('a',passage),fixture('b',passage,{category:'STATISTICS'})],p,'live');assert.ok(result.issues.some(i=>i.issueType===type),`${name}: ${JSON.stringify(result.issues.map(i=>i.issueType))}`);assert.ok(result.issues.every(i=>!i.summary.includes('시설이 부족')));}
});
test('metadata-only/weak LIVE evidence does not fabricate an issue; unrelated or negated relations not promoted',()=>{
 assert.equal(analyzeIssues([fixture('a',text,{extractedClaims:[]})],profile,'live').issues.length,0);
 assert.equal(analyzeIssues([fixture('a',text,{evaluationCompleteness:{available:1,total:5}})],profile,'live').issues.length,0);
 for(const passage of ['용인시에서 인구가 감소한다. 용인시에서 시설 분포를 조사한다.','용인시에서 인구가 감소한다. 용인시에서 시설 분포와 생활권의 불일치는 없다.'])assert.equal(analyzeIssues([fixture('a',passage)],profile,'live').issues.length,0);
});
test('trace issue → relationship → phenomena → exact source passage; no causal relationships generated',()=>{
 const items=[fixture('a'),fixture('b',text,{category:'STATISTICS'})];const before=structuredClone(items);const analysis=analyzeIssues(items,profile,'live');
 for(const issue of analysis.issues){for(const id of issue.relationshipIds){const r=analysis.relationships.find(r=>r.id===id);assert.ok(r);assert.notEqual(r.relationshipType,'POSSIBLE_CAUSAL_LINK');for(const pid of [r.phenomenonA,r.phenomenonB]){const p=analysis.phenomena.find(p=>p.id===pid);assert.ok(p);for(const passage of p.passages)assert.ok(items.find(i=>i.id===passage.evidenceId).snippet.includes(passage.quote));}}}
 assert.deepEqual(items,before);
});
test('national-only context never becomes local proof; cross-region endpoints do not make a local relationship',()=>{
 const national=fixture('n',text.replaceAll('용인시','전국'),{geographicScope:'NATIONAL'});const analysis=analyzeIssues([national],profile,'live');assert.ok(analysis.issues.length);assert.equal(analysis.issues[0].relatedRegions.length,0);
 const definition=generateProblemDefinition({facility:profile,issue:analysis.issues[0],region:null,nationalContext:[national],mode:'live',referenceDate:now});assert.equal(definition.sections.regionalExpression.status,'limited');assert.equal(definition.sections.regionalExpression.evidenceIds.length,0);
 assert.equal(analyzeIssues([fixture('cross',text.replace('기존 시설','기존 시설').replace('용인시에서 기존','평택시에서 기존'))],profile,'live').issues.length,0);
});
test('duplicate claims preserve sources, group exact copies and cap publisher contribution',()=>{
 const a=fixture('a');const b=fixture('b',text,{category:'STATISTICS'});const base=input([a,b]);const claims=extractClaims(base);assert.equal(claims.length,2);assert.equal(claims[0].evidenceIds.length,2);assert.equal(claims[0].sourceCount,2);
 const repeated=Array.from({length:20},(_,i)=>({...a,id:`repeat-${i}`,url:`https://a.example/${i}`}));const repeatedInput=input([a,b,...repeated]);const grouped=extractClaims(repeatedInput);assert.equal(grouped.length,2);assert.equal(grouped[0].strength,claims[0].strength);assert.equal(grouped[0].sourceCount,2);
});
test('opposing claims stay visible, reduce issue confidence and appear beside supporting claims',()=>{
 const a=fixture('a');const b=fixture('b',text,{category:'STATISTICS'});const conflict=fixture('c','용인시에서 인구가 감소한다. 용인시에서 기존 시설 이용률은 감소하지만 생활권 접근성 검토가 함께 필요하다.',{stance:'WEAKENS_NEED'});
 const args=input([a,b,conflict]);assert.ok(args.issue.conflictingEvidenceIds.includes(conflict.id));assert.equal(args.issue.confidence,'LOW');const definition=generateProblemDefinition(args);assert.ok(definition.contradictoryClaims.length);assert.ok(definition.sections.regionalExpression.claimIds.some(id=>definition.contradictoryClaims.includes(id)));assert.ok(definition.limitations.some(l=>l.includes('상반')));
});
test('supported factual sections quote existing claims only; no invented quantities',()=>{
 const args=input([fixture('a'),fixture('b',text,{category:'STATISTICS'})]);const definition=generateProblemDefinition(args);
 assert.equal(definition.sections.regionalExpression.status,'supported');assert.ok(definition.claims.every(c=>c.quantitativeValues.length===0));assert.ok(definition.limitations.some(l=>l.includes('정량')));
 for(const section of Object.values(definition.sections))for(const statement of section.statements){assert.ok(statement.claimIds.length);for(const id of statement.claimIds){const c=definition.claims.find(c=>c.id===id);assert.ok(statement.text.includes(c.claim));assert.ok(c.evidenceIds.every(id=>definition.evidenceItems.some(i=>i.id===id&&i.url)));}}
});
test('unknown dates/old evidence yield uncertainty, not urgency; unsupported extracted paraphrases rejected',()=>{
 const args=input([fixture('a',text,{publishedDate:null}),fixture('b',text,{publishedDate:'2010-01-01'})]);const d=generateProblemDefinition(args);assert.equal(d.sections.background.status,'limited');assert.equal(d.gaps.outdatedEvidence.length,1);assert.equal(d.gaps.undatedEvidence.length,1);assert.ok(!d.sections.background.body.includes('위기'));
 const bad=fixture('bad',text,{extractedClaims:[{text:'시설 부족 42%',sourceExcerpt:text,sourceLocator:null}]});assert.equal(analyzeIssues([bad],profile,'live').issues.length,0);
});
test('edits never mutate generated evidence; individual regeneration uses immutable same snapshot',()=>{
 const args=input([fixture('a'),fixture('b')]);const before=structuredClone(args);const d=generateProblemDefinition(args);const original=structuredClone(d);const edit=editSection(d.sections.background,{body:'사용자 임의 주장'});assert.equal(edit.userEdited,true);assert.deepEqual(d,original);assert.deepEqual(args,before);assert.deepEqual(regenerateSection(args,'background'),d.sections.background);assert.ok(!regenerateSection(args,'background').body.includes('사용자 임의 주장'));
});
test('DEMO stays insufficient, provides traversable issue workflow and no real source URL',async()=>{
 const raw=await createDemoProvider().search(query,new AbortController().signal);const items=raw.map(r=>analyzeEvidence(normalizeEvidence(r,query),profile,plan,{referenceDate:now}));const analysis=analyzeIssues(items,profile,'demo');assert.ok(analysis.issues.length);assert.ok(analysis.issues.every(i=>i.mode==='demo'&&i.confidence==='INSUFFICIENT'));assert.equal(analyzeIssues(items,profile,'live').issues.length,0);
 const issue=analysis.issues.find(i=>i.relatedRegions.length);assert.ok(issue);const region=mapGeographicEvidence(items,'demo').profiles.find(p=>issue.relatedRegions.some(r=>r.id===p.region.id));const d=generateProblemDefinition({facility:profile,issue,region,nationalContext:[],mode:'demo',referenceDate:now});assert.ok(d.gaps.unsupportedSections.length===4);assert.ok(d.evidenceItems.every(i=>i.url===null));assert.ok(d.limitations.some(l=>l.includes('DEMO')));
});

test('selected issue mapping excludes unrelated regions and keeps original regional scores',()=>{
 const a=fixture('a');const b=fixture('b',text,{category:'STATISTICS'});const args=input([a,b]);
 const unrelated=fixture('unrelated',text.replaceAll('용인시','평택시'));
 const mapped=mapIssueEvidence(args.issue,[a,b,unrelated],'live');assert.equal(mapped.profiles.length,1);assert.ok(mapped.profiles.every(p=>p.region.displayName.includes('용인')));assert.ok(mapped.profiles.every(p=>p.evidenceItems.every(i=>args.issue.evidenceIds.includes(i.id))));
 const national=fixture('national',text.replaceAll('용인시','전국'),{geographicScope:'NATIONAL'});
 const withNational=mapIssueEvidence({...args.issue,evidenceIds:[...args.issue.evidenceIds,national.id]},[a,b,national],'live');assert.equal(withNational.nationalContext.length,1);assert.equal(withNational.candidates[0].candidateScore,mapped.candidates[0].candidateScore);
});
