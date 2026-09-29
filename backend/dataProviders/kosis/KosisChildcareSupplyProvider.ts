import {matchSigungu} from '../../../frontend/services/geography/sigunguRegistry';
import type {RegionalFacilitySupply} from '../../../frontend/services/regional/facilityNeed';
import {KosisClient} from './kosisClient';
import {KosisError,textField as t,type KosisRow} from './kosisTypes';

const table={orgId:'101',tableId:'DT_1YL20951',name:'유아 천명당 보육시설수(시도/시/군/구)',ratioItem:'T10',countItem:'T001',url:'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1YL20951'} as const;
const number=(row:KosisRow)=>{const raw=t(row,'DT').replaceAll(',','');if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))return null;const value=Number(raw);return Number.isFinite(value)?value:null;};

export interface KosisChildcareQuality {rawRows:number;validRows:number;matchedRegions:number;unmatchedRows:number;unknownRegions:number;referencePeriod:string;unit:string}

export class KosisChildcareSupplyProvider {
 private cache:{until:number;rows:RegionalFacilitySupply[];quality:KosisChildcareQuality}|null=null;
 constructor(private client:KosisClient,private ttlMs=3600000){}
 async getSupply():Promise<RegionalFacilitySupply[]>{
  if(this.cache&&this.cache.until>Date.now())return structuredClone(this.cache.rows);
  const base={method:'getMeta',orgId:table.orgId,tblId:table.tableId};
  const [periodResult,itemResult]=await Promise.all([
   this.client.request('statisticsData.do',{...base,type:'PRD',detail:'Y'}),
   this.client.request('statisticsData.do',{...base,type:'ITM',objId:'',itmId:''}),
  ]);
  const periods=periodResult.rows.map(r=>t(r,'PRD_DE')).filter(v=>/^\d{4}$/.test(v)).sort();const period=periods.at(-1);if(!period)throw new KosisError('INVALID_METADATA','보육시설 공급 기준연도를 확인하지 못했습니다.');
  const items=itemResult.rows;const ratioMeta=items.find(r=>t(r,'OBJ_ID')==='ITEM'&&t(r,'ITM_ID')===table.ratioItem),countMeta=items.find(r=>t(r,'OBJ_ID')==='ITEM'&&t(r,'ITM_ID')===table.countItem);if(!ratioMeta||t(ratioMeta,'UNIT_NM')!=='개'||!countMeta)throw new KosisError('INVALID_METADATA','보육시설 공급 항목과 단위를 확인하지 못했습니다.');
  const params={method:'getList',orgId:table.orgId,tblId:table.tableId,objL1:'ALL',prdSe:'Y',startPrdDe:period,endPrdDe:period};
  const [ratioResult,countResult]=await Promise.all([this.client.request('Param/statisticsParameterData.do',{...params,itmId:table.ratioItem}),this.client.request('Param/statisticsParameterData.do',{...params,itmId:table.countItem})]);
  const regionMeta=new Map(items.filter(r=>t(r,'OBJ_ID')==='SGG').map(r=>[t(r,'ITM_ID'),r]));const counts=new Map(countResult.rows.map(r=>[t(r,'C1'),number(r)]));const retrievedAt=ratioResult.retrievedAt;let unmatchedRows=0,validRows=0;const rows:RegionalFacilitySupply[]=[];const used=new Set<string>();
  for(const row of ratioResult.rows){const value=number(row);if(value===null)continue;validRows++;const id=t(row,'C1'),meta=regionMeta.get(id),parent=meta?regionMeta.get(t(meta,'UP_ITM_ID')):undefined;const full=[parent&&t(parent,'ITM_NM'),t(row,'C1_NM')].filter(Boolean).join(' ');const region=matchSigungu(full).region;if(!region?.analysisUnit||used.has(region.regionCode)){unmatchedRows++;continue;}used.add(region.regionCode);const facilityCount=counts.get(id)??null;rows.push({regionCode:region.regionCode,regionName:region.fullName,facilityType:'어린이집',facilityCount,supplyMetricType:'FACILITIES_PER_1000_CHILDREN',supplyValue:value,supplyUnit:'개/유아 1,000명',facilitiesPer100k:null,targetPopulationPerFacility:facilityCount&&facilityCount>0?null:null,verificationStatus:'SOURCE_VERIFIED',source:{provider:'KOSIS',dataset:table.name,period,rowPeriodStart:period,rowPeriodEnd:period,url:table.url,retrievedAt},recordIds:[`KOSIS:${table.tableId}:${period}:${id}:${table.ratioItem}`,`KOSIS:${table.tableId}:${period}:${id}:${table.countItem}`],limitations:['0–5세 주민등록인구 대비 보육시설 수를 나타내며 정원·입소 가능성·거리 접근성을 의미하지 않습니다.','KOSIS 분류에서 현재 프로젝트의 시군구 분석 단위로 안전하게 결합된 지역만 비교합니다.']});}
  const quality={rawRows:ratioResult.rows.length,validRows,matchedRegions:rows.length,unmatchedRows,unknownRegions:256-rows.length,referencePeriod:period,unit:'개/유아 1,000명'};this.cache={until:Date.now()+this.ttlMs,rows,quality};return structuredClone(rows);
 }
 quality(){return this.cache?structuredClone(this.cache.quality):null;}
 metadata(){return {provider:'KOSIS',dataset:table.name,tableId:table.tableId,sourceUrl:table.url,formula:'보육시설 수 / 주민등록인구(0–5세) × 1,000',frequency:'연간'};}
}
