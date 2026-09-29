import {matchSigungu} from '../../../frontend/services/geography/sigunguRegistry';
import type {RegionalFacilitySupply} from '../../../frontend/services/regional/facilityNeed';

interface Definition {facilityType:string;publicDataPk:string;dataset:string;sourceUrl:string;name:string;sido:string;sigungu:string;address:string;date:string;include:(row:Record<string,unknown>)=>boolean}
const definitions:Record<string,Definition>={
 '도서관':{facilityType:'도서관',publicDataPk:'15013109',dataset:'전국도서관표준데이터',sourceUrl:'https://www.data.go.kr/data/15013109/standard.do',name:'LBRRY_NM',sido:'CTPRVN_NM',sigungu:'SIGNGU_NM',address:'RDNMADR',date:'REFERENCE_DATE',include:r=>String(r.LBRRY_SE??'')==='공공도서관'},
 '청소년 문화센터':{facilityType:'청소년 문화센터',publicDataPk:'15129449',dataset:'전국청소년수련시설표준데이터',sourceUrl:'https://www.data.go.kr/data/15129449/standard.do',name:'FCLT_NM',sido:'CTPV_NM',sigungu:'SGG_NM',address:'LCTN_ROAD_NM',date:'DATA_CRTR_YMD',include:()=>true},
};
export interface FacilitySupplyQuality {sourceRows:number;eligibleRows:number;includedRows:number;duplicateRows:number;unmatchedRows:number;matchedRegions:number;unknownRegions:number}
const value=(row:Record<string,unknown>,key:string)=>{const actual=Object.keys(row).find(candidate=>candidate.toLowerCase()===key.toLowerCase());const candidate=actual?row[actual]:undefined;return typeof candidate==='string'?candidate.trim():'';};
export class PublicStandardFacilityProvider {
 private cache=new Map<string,{until:number;rows:RegionalFacilitySupply[];quality:FacilitySupplyQuality}>();
 constructor(private fetcher:typeof fetch=fetch,private ttlMs=3600000){}
 supports(facilityType:string){return !!definitions[facilityType];}
 metadata(facilityType:string){const d=definitions[facilityType];return d?{dataset:d.dataset,sourceUrl:d.sourceUrl,publicDataPk:d.publicDataPk}:null;}
 async getSupply(facilityType:string):Promise<RegionalFacilitySupply[]>{
  const d=definitions[facilityType];if(!d)return [];const cached=this.cache.get(facilityType);if(cached&&cached.until>Date.now())return structuredClone(cached.rows);
  const headerUrl=new URL('https://www.data.go.kr/download/columList.json');headerUrl.search=new URLSearchParams({pk:d.publicDataPk,ext:'JSON'}).toString();const headerResponse=await this.fetcher(headerUrl,{signal:AbortSignal.timeout(20000)});if(!headerResponse.ok)throw new Error('FACILITY_SUPPLY_HEADER_FAILED');const header=await headerResponse.json() as {totalCount?:number;tableVO?:{svcTableNm?:string;colNmList?:string[]}};
  if(!Number.isInteger(header.totalCount)||!header.tableVO?.svcTableNm||!Array.isArray(header.tableVO.colNmList))throw new Error('FACILITY_SUPPLY_HEADER_INVALID');
  const fields=[d.name,d.sido,d.sigungu,d.address,d.date,...(facilityType==='도서관'?['LBRRY_SE']:[])];const params=new URLSearchParams({publicDataPk:d.publicDataPk,totalCount:String(header.totalCount),svcTableNm:header.tableVO.svcTableNm,perPage:String(header.totalCount),page:'1'});for(const field of fields)params.append('colNmList',field);
  const dataResponse=await this.fetcher('https://www.data.go.kr/download/standard.json?'+params,{signal:AbortSignal.timeout(30000)});if(!dataResponse.ok)throw new Error('FACILITY_SUPPLY_DATA_FAILED');const payload=await dataResponse.json();if(!Array.isArray(payload))throw new Error('FACILITY_SUPPLY_DATA_INVALID');const retrievedAt=new Date().toISOString();
  const unique=new Map<string,{row:Record<string,unknown>;region:NonNullable<ReturnType<typeof matchSigungu>['region']>}>();
  let eligibleRows=0,unmatchedRows=0,duplicateRows=0;
  for(const unknownRow of payload){if(!unknownRow||typeof unknownRow!=='object')continue;const row=unknownRow as Record<string,unknown>;if(!d.include(row))continue;eligibleRows++;const full=(value(row,d.sido)+' '+value(row,d.sigungu)).trim(),region=matchSigungu(full).region;if(!region){unmatchedRows++;continue;}const key=[region.regionCode,value(row,d.name),value(row,d.address)].join('|');if(unique.has(key)){duplicateRows++;continue;}unique.set(key,{row,region});}
  const groups=new Map<string,{region:NonNullable<ReturnType<typeof matchSigungu>['region']>;rows:Record<string,unknown>[]}>();for(const entry of unique.values()){const prior=groups.get(entry.region.regionCode);groups.set(entry.region.regionCode,{region:entry.region,rows:[...(prior?.rows??[]),entry.row]});}
  const rows=[...groups.values()].map(({region,rows})=>{const dates=rows.map(r=>value(r,d.date)).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)).sort();return {regionCode:region.regionCode,regionName:region.fullName,facilityType:d.facilityType,facilityCount:rows.length,facilitiesPer100k:null,targetPopulationPerFacility:null,verificationStatus:'PARTIAL' as const,source:{provider:'DATA_GO_KR_STANDARD_DOWNLOAD',dataset:d.dataset,period:retrievedAt.slice(0,10),rowPeriodStart:dates[0]??null,rowPeriodEnd:dates.at(-1)??null,url:d.sourceUrl,retrievedAt},recordIds:rows.map(r=>[value(r,d.name),value(r,d.address)].join('|')),limitations:['표준데이터 수록 시설의 현재 목록 스냅샷입니다. 행별 기준일이 다를 수 있습니다.','운영상태 필드가 없어 폐쇄 여부를 독립 검증하지 못했습니다.','수록되지 않은 지역은 시설 0개가 아니라 UNKNOWN입니다.']};});
  const quality={sourceRows:payload.length,eligibleRows,includedRows:unique.size,duplicateRows,unmatchedRows,matchedRegions:rows.length,unknownRegions:256-rows.length};
  this.cache.set(facilityType,{until:Date.now()+this.ttlMs,rows,quality});return structuredClone(rows);
 }
 quality(facilityType:string){const cached=this.cache.get(facilityType);return cached?structuredClone(cached.quality):null;}
}
