import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,loadEnv} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>vite.close());
const {normalizeKosisPeriods,KosisProvider}=await vite.ssrLoadModule('/backend/dataProviders/kosis/KosisProvider.ts');
const {KosisClient}=await vite.ssrLoadModule('/backend/dataProviders/kosis/kosisClient.ts');
const {normalizeAgePopulation,kosisCoverage}=await vite.ssrLoadModule('/backend/dataProviders/kosis/agePopulation.ts');
const {interpretFacility}=await vite.ssrLoadModule('/frontend/services/interpretFacility.ts');
const {targetPopulationProfile}=await vite.ssrLoadModule('/frontend/services/demographics/targetPopulation.ts');
const {demographicEngine}=await vite.ssrLoadModule('/frontend/services/demographics/engine.ts');
const fixture=JSON.parse(await readFile('tests/fixtures/kosis-age-real.json','utf8'));
const target=targetPopulationProfile(await interpretFacility('어린이집'));
const normalize=rows=>normalizeAgePopulation(rows,fixture.metadata,target,fixture.retrievedAt,['202608'],'M');
test('actual heading-based period metadata supports monthly and annual observations',()=>{
 const periods=normalizeKosisPeriods(fixture.metadata.rawPeriods);
 assert.ok(periods.some(p=>p.PRD_SE==='M'&&p.PRD_DE==='202608'));
 assert.ok(periods.some(p=>p.PRD_SE==='Y'&&p.PRD_DE==='2025'));
 assert.deepEqual(normalizeKosisPeriods([{PRD_SE:'월'},{PRD_DE:'2026.13'}]),[]);
});
test('recorded real response maps skipped city parents and preserves values and provenance',()=>{
 const metrics=normalize(fixture.rows);const giheung=metrics.find(m=>m.regionCode==='41463'&&m.metricType==='TARGET_POPULATION');
 assert.equal(giheung.value,13748);assert.equal(giheung.regionName,'경기도 용인시 기흥구');assert.equal(giheung.structuredSource.providerRegionCode,'41463');assert.equal(giheung.structuredSource.tableId,'DT_1B04006');assert.equal(giheung.structuredSource.itemId,'T2');assert.equal(giheung.structuredSource.retrievedAt,fixture.retrievedAt);assert.equal(giheung.derivation.inputMetricIds.length,6);
 const totals=metrics.filter(m=>m.metricType==='TOTAL_POPULATION');assert.equal(totals.find(m=>m.structuredSource.providerRegionCode==='36').administrativeLevel,'SIDO');assert.equal(totals.find(m=>m.structuredSource.providerRegionCode==='36110').administrativeLevel,'SIGUNGU');
 assert.equal(kosisCoverage(fixture.rows,fixture.metadata)[0].normalizedSigunguCount,4);
});
test('recorded rows with missing age cells stay missing; DEMO contributes no real values',()=>{
 const rows=fixture.rows.filter(r=>!(r.C1==='41463'&&r.C2==='0401'));
 assert.equal(normalize(rows).find(m=>m.regionCode==='41463'&&m.metricType==='TARGET_POPULATION').value,null);
 assert.equal(demographicEngine(normalize(fixture.rows).map(m=>({...m,dataMode:'DEMO'})),target,'live').coverage.missing,256);
});
test('unit metadata NO DATA uses explicit ITEM unit; authentication errors never trigger fallback',async()=>{
 const types={TBL:'table',ORG:'organization',PRD:'rawPeriods',ITM:'classifications'};
 const make=code=>new KosisProvider(new KosisClient('TEST-ONLY',async url=>new Response(JSON.stringify(url.searchParams.get('type')==='UNIT'?{err:code}:fixture.metadata[types[url.searchParams.get('type')]])),0,0));
 assert.ok((await make('30').getMetadata('age-population')).units.some(u=>u.UNIT_NM==='명'&&u.metadataSource==='ITM'));
 await assert.rejects(make('20').getMetadata('age-population'),e=>e.code==='API_ERROR');
});
test('Vite loads a server-only local key and env files remain ignored',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fnf-env-'));
 try{await writeFile(join(dir,'.env.local'),'KOSIS_API_KEY=TEST-ONLY-LOCAL\n');assert.equal(loadEnv('development',dir,'').KOSIS_API_KEY,process.env.KOSIS_API_KEY??'TEST-ONLY-LOCAL');assert.equal(loadEnv('development',dir).KOSIS_API_KEY,undefined);}finally{await rm(dir,{recursive:true,force:true});}
 const ignored=await readFile('.gitignore','utf8');assert.match(ignored,/^\.env$/m);assert.match(ignored,/^\.env\.\*$/m);
});

test('missing parent for an ambiguous district is unresolved, never promoted to SIGUNGU or SIDO',()=>{
 const rows=fixture.rows.filter(r=>r.C1==='41463').map(r=>({...r,C1:'TEST-AMBIGUOUS',C1_NM:'중구'}));
 const metadata={...fixture.metadata,classifications:[...fixture.metadata.classifications,{OBJ_ID:'A',OBJ_ID_SN:'1',ITM_ID:'TEST-AMBIGUOUS',ITM_NM:'중구'}]};
 const result=normalizeAgePopulation(rows,metadata,target,fixture.retrievedAt,['202608'],'M');assert.ok(result.every(m=>m.regionCode===null&&m.administrativeLevel==='UNKNOWN'&&m.structuredSource.normalizationStatus==='AMBIGUOUS'));assert.equal(kosisCoverage(rows,metadata)[0].ambiguousRegionCount,1);
});
