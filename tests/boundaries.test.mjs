import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,ws:false},appType:'custom'});after(()=>server.close());
const {parseSidoBoundaries,projectSidoBoundaries,joinSidoEvidence,sidoCode}=await server.ssrLoadModule('/frontend/services/geography/boundaries/koreaSido.ts');
const raw=JSON.parse(await readFile(new URL('../data/geography/korea_sido.geojson',import.meta.url),'utf8'));
test('vendored real boundaries have exactly 17 unique ADM1 regions; invalid or missing geometry fails closed',()=>{
 assert.equal(parseSidoBoundaries(raw).features.length,17);
 assert.throws(()=>parseSidoBoundaries({type:'FeatureCollection',features:[]}));
 const bad=structuredClone(raw);bad.features[0].geometry.coordinates=[];assert.throws(()=>parseSidoBoundaries(bad));
});
test('projection preserves north/south, east/west, separate Jeju and original geographic vertices',()=>{
 const before=structuredClone(raw);const map=projectSidoBoundaries(raw);assert.equal(map.features.length,17);assert.ok(map.features.every(f=>f.path.length>50&&!f.path.includes('NaN')));
 const seoul=map.projection([126.978,37.566]);const busan=map.projection([129.076,35.18]);const jeju=map.projection([126.53,33.50]);
 assert.ok(seoul[1]<busan[1]&&busan[1]<jeju[1]);assert.ok(seoul[0]<busan[0]&&jeju[0]<busan[0]);assert.deepEqual(raw,before);
});
const reference=(level1,level2=null)=>({id:'test',regionCode:null,normalizationStatus:'matched',level1,level2,level3:null,displayName:level1});
test('names safely join current/old names; only namespaced source identifiers match codes',()=>{
 assert.equal(sidoCode(reference('강원도')),'KR-42');assert.equal(sidoCode(reference('전북특별자치도')),'KR-45');assert.equal(sidoCode(reference('경기도','용인시')),'KR-41');assert.equal(sidoCode({...reference('모름'),regionCode:'31'}),null);assert.equal(sidoCode({...reference('경기도'),normalizationStatus:'ambiguous'}),null);
});
test('no evidence stays neutral; local signals remain explicitly separate from province scores',()=>{
 const feature=raw.features.find(f=>f.properties.shapeISO==='KR-41');const empty=joinSidoEvidence(feature,[]);assert.equal(empty.colorSignal,null);assert.equal(empty.evidenceCount,0);
 const local={region:reference('경기도','용인시'),candidateScore:76,evidenceItems:[{id:'a'},{id:'b'}]};const another={...local,region:reference('경기도','평택시'),candidateScore:60,evidenceItems:[{id:'a'}]};
 const joined=joinSidoEvidence(feature,[local,another]);assert.equal(joined.evidenceCount,2);assert.equal(joined.signal,null);assert.equal(joined.childSignal,76);assert.equal(joined.children.length,2);
 const province={region:reference('경기도'),candidateScore:42,evidenceItems:[{id:'c'}]};assert.equal(joinSidoEvidence(feature,[local,province]).signal,42);
});
