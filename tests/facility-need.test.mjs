import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
const {PublicStandardFacilityProvider}=await vite.ssrLoadModule('/backend/dataProviders/publicStandard/PublicStandardFacilityProvider.ts');
const {compareFacilityNeed}=await vite.ssrLoadModule('/frontend/services/regional/facilityNeed.ts');
const {KosisChildcareSupplyProvider}=await vite.ssrLoadModule('/backend/dataProviders/kosis/KosisChildcareSupplyProvider.ts');
const {interpretFacility}=await vite.ssrLoadModule('/frontend/services/interpretFacility.ts');
const {targetPopulationProfile}=await vite.ssrLoadModule('/frontend/services/demographics/targetPopulation.ts');
const {buildFacilitySelectionBasis}=await vite.ssrLoadModule('/frontend/services/regional/selectionBasis.ts');
test.after(()=>vite.close());

const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('official standard supply normalizes codes, removes duplicates, preserves provenance and never creates zero rows',async()=>{
 const rows=[
  {LBRRY_NM:'A도서관',CTPRVN_NM:'경기도',SIGNGU_NM:'남양주시',RDNMADR:'경기도 남양주시 A로 1',REFERENCE_DATE:'2026-01-01',LBRRY_SE:'공공도서관'},
  {LBRRY_NM:'A도서관',CTPRVN_NM:'경기도',SIGNGU_NM:'남양주시',RDNMADR:'경기도 남양주시 A로 1',REFERENCE_DATE:'2026-01-01',LBRRY_SE:'공공도서관'},
  {LBRRY_NM:'B도서관',CTPRVN_NM:'서울특별시',SIGNGU_NM:'송파구',RDNMADR:'서울특별시 송파구 B로 2',REFERENCE_DATE:'2025-12-31',LBRRY_SE:'공공도서관'},
  {LBRRY_NM:'학교도서관',CTPRVN_NM:'경기도',SIGNGU_NM:'남양주시',RDNMADR:'경기도 남양주시 C로 3',REFERENCE_DATE:'2026-01-01',LBRRY_SE:'학교도서관'},
  {LBRRY_NM:'모호',CTPRVN_NM:'',SIGNGU_NM:'중구',RDNMADR:'',REFERENCE_DATE:'',LBRRY_SE:'공공도서관'}
 ];
 const fetcher=async url=>String(url).includes('columList')?response({totalCount:rows.length,tableVO:{svcTableNm:'library',colNmList:[]}}):response(rows);
 const result=await new PublicStandardFacilityProvider(fetcher,0).getSupply('도서관');
 assert.equal(result.length,2);assert.equal(result.find(r=>r.regionCode==='41360').facilityCount,1);assert.equal(result.find(r=>r.regionCode==='11710').facilityCount,1);
 assert.ok(result.every(r=>r.verificationStatus==='PARTIAL'&&r.source.url.includes('data.go.kr')&&r.recordIds.length===1));
 assert.equal(result.some(r=>r.facilityCount===0),false);assert.ok(result.every(r=>r.limitations.some(v=>v.includes('UNKNOWN'))));
});

test('need comparison keeps demand/supply separate, computes per-capita values and ranks deterministically',()=>{
 const metric=(code,value,id)=>({metricId:id,metricType:'TARGET_POPULATION',dataMode:'LIVE',regionCode:code,value,referenceDate:'2026-08'});
 const position=(value,p)=>({metric:'TARGET_POPULATION',rawValue:value,percentile:p,referencePeriod:'2026-08'});
 const source={provider:'TEST',dataset:'TEST',period:'2026-08',rowPeriodStart:'2026-08',rowPeriodEnd:'2026-08',url:'https://example.test',retrievedAt:'2026-09-01'};
 const supply=(code,name,count)=>({regionCode:code,regionName:name,facilityType:'도서관',facilityCount:count,facilitiesPer100k:null,targetPopulationPerFacility:null,verificationStatus:'SOURCE_VERIFIED',source,recordIds:Array.from({length:count},(_,i)=>String(i)),limitations:[]});
 const result=compareFacilityNeed([{metric:metric('A',100000,'dA'),position:position(100000,90)},{metric:metric('B',80000,'dB'),position:position(80000,70)},{metric:metric('C',50000,'dC'),position:position(50000,30)}],[supply('A','A',1),supply('B','B',8),supply('C','C',5),{...supply('D','D',0),facilityCount:null,verificationStatus:'UNKNOWN'}]);
 assert.equal(result.length,3);assert.equal(result[0].regionCode,'A');assert.equal(result[0].classification,'HIGH_DEMAND_LOW_SUPPLY');assert.equal(result[0].supply.facilitiesPer100k,1);assert.equal(result[0].supply.targetPopulationPerFacility,100000);
 assert.equal(result.some(r=>r.regionCode==='D'),false);assert.equal(result[0].supply.source.dataset,'TEST');
});

test('KOSIS childcare supply selects latest year, preserves the official ratio and excludes unmatched regions',async()=>{
 const requests=[];const client={request:async(path,params)=>{requests.push([path,params]);if(params.type==='PRD')return {rows:[{PRD_SE:'년'},{PRD_DE:'2024'},{PRD_DE:'2025'}],retrievedAt:'2026-09-26T00:00:00Z'};if(params.type==='ITM')return {rows:[{OBJ_ID:'ITEM',ITM_ID:'T10',UNIT_NM:'개'},{OBJ_ID:'ITEM',ITM_ID:'T001',UNIT_NM:'개'},{OBJ_ID:'SGG',ITM_ID:'11',ITM_NM:'서울특별시'},{OBJ_ID:'SGG',ITM_ID:'11010',UP_ITM_ID:'11',ITM_NM:'종로구'},{OBJ_ID:'SGG',ITM_ID:'X',ITM_NM:'알수없음'}],retrievedAt:'2026-09-26T00:00:00Z'};return {rows:params.itmId==='T10'?[{C1:'11010',C1_NM:'종로구',DT:'22.8'},{C1:'X',C1_NM:'알수없음',DT:'0'}]:[{C1:'11010',DT:'61'}],retrievedAt:'2026-09-26T00:00:00Z'};}};
 const provider=new KosisChildcareSupplyProvider(client,0),rows=await provider.getSupply();assert.equal(rows.length,1);assert.equal(rows[0].regionCode,'11110');assert.equal(rows[0].facilityCount,61);assert.equal(rows[0].supplyValue,22.8);assert.equal(rows[0].supplyUnit,'개/유아 1,000명');assert.equal(rows[0].source.period,'2025');assert.equal(rows[0].verificationStatus,'SOURCE_VERIFIED');assert.equal(provider.quality().unmatchedRows,1);assert.ok(requests.filter(([,p])=>p.itmId==='T10').every(([,p])=>p.startPrdDe==='2025'&&p.endPrdDe==='2025'));
});

test('childcare ranking uses the official per-1000 supply value instead of recomputing from facility count',()=>{
 const metric=(code,value,id)=>({metricId:id,metricType:'TARGET_POPULATION',dataMode:'LIVE',regionCode:code,value,referenceDate:'2026-08'}),position=(value,p)=>({metric:'TARGET_POPULATION',rawValue:value,percentile:p,referencePeriod:'2026-08'});const source={provider:'KOSIS',dataset:'TEST',period:'2025',rowPeriodStart:'2025',rowPeriodEnd:'2025',url:'https://kosis.kr',retrievedAt:'2026-09-26'};
 const row=(code,name,count,ratio)=>({regionCode:code,regionName:name,facilityType:'어린이집',facilityCount:count,supplyMetricType:'FACILITIES_PER_1000_CHILDREN',supplyValue:ratio,supplyUnit:'개/유아 1,000명',facilitiesPer100k:null,targetPopulationPerFacility:null,verificationStatus:'SOURCE_VERIFIED',source,recordIds:[code],limitations:[]});
 const result=compareFacilityNeed([{metric:metric('A',20000,'A'),position:position(20000,90)},{metric:metric('B',15000,'B'),position:position(15000,80)}],[row('A','A',200,5),row('B','B',10,20)]);assert.equal(result[0].regionCode,'A');assert.equal(result[0].classification,'HIGH_DEMAND_LOW_SUPPLY');assert.equal(result[0].supply.supplyValue,5);
});
test('selection basis rejects total-population-only facilities and documents admitted indicators',async()=>{
 const metric=(type='TARGET_POPULATION')=>({metricType:type,dataMode:'LIVE',verification:'source_verified',administrativeLevel:'SIGUNGU',value:100,referenceDate:'2026-08',regionCode:'41220'});const source={period:'2025'};
 const childcare=await interpretFacility('어린이집'),childcareTarget=targetPopulationProfile(childcare);const childcareBasis=buildFacilitySelectionBasis(childcare,childcareTarget,[metric(),{...metric(),regionCode:'11710'}],[{verificationStatus:'SOURCE_VERIFIED',supplyValue:12,facilityCount:20,source},{verificationStatus:'SOURCE_VERIFIED',supplyValue:15,facilityCount:30,source}]);
 assert.equal(childcareBasis.status,'VALID');assert.deepEqual(childcareBasis.selectedIndicators.map(row=>row.indicator),['0–5세 인구','유아 천 명당 보육시설 수']);assert.ok(childcareBasis.selectedIndicators.every(row=>row.reason&&row.source&&row.referencePeriod&&row.geographicResolution==='SIGUNGU'));
 const maker=await interpretFacility('메이커스페이스'),makerBasis=buildFacilitySelectionBasis(maker,targetPopulationProfile(maker),[metric(),{...metric(),regionCode:'11710'}],[]);assert.equal(makerBasis.status,'INSUFFICIENT_SELECTION_BASIS');assert.ok(makerBasis.rejectedIndicators.some(row=>row.indicator==='총인구'&&row.reason.includes('일반적')));
});
