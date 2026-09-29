import {matchSigungu} from '../../../frontend/services/geography/sigunguRegistry';
import {aggregateFacilities,type FacilityRecord,type FacilitySupplyProvider} from '../../../frontend/services/dataProviders/facilitySupply';
import {parsePopulation} from '../kosis/kosisNormalizer';
import {KosisError} from '../kosis/kosisTypes';
const source='https://info.childcare.go.kr/info/oais/openapi/OpenApiInfoSl.jsp?flag=VIEW&svcseq=82';
export function parseChildcareXml(xml:string):Record<string,string>[] {
 if(xml.length>8_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<response(?:\s|>)/i.test(xml)||!/<\/response>\s*$/.test(xml))throw new KosisError('INVALID_RESPONSE','어린이집 XML 형식을 확인하지 못했습니다.');
 if(/(?:ERROR|INFO)-\d{3}/.test(xml))throw new KosisError('PROVIDER_ERROR','어린이집 API의 인증·검색결과·이용 한도를 확인해 주세요.');
 const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);if(v>0x10ffff||v<0)throw new Error('Invalid XML character');return String.fromCodePoint(v);}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').trim();
 const matches=[...xml.matchAll(/<item\s*>([\s\S]*?)<\/item>/g)];if(!matches.length)throw new KosisError('EMPTY_RESPONSE','시설 자료가 없습니다. 0개 시설로 간주하지 않습니다.');
 return matches.map(match=>{const row:Record<string,string>={};const body=match[1];const fields=[...body.matchAll(/<([A-Za-z_][\w]*)\s*(?:\/>|>([\s\S]*?)<\/\1>)/g)];if(body.replace(/<([A-Za-z_][\w]*)\s*(?:\/>|>[\s\S]*?<\/\1>)/g,'').trim())throw new KosisError('INVALID_RESPONSE','알 수 없는 시설 XML 구조입니다.');for(const f of fields){const key=f[1].toLowerCase();if(key in row)throw new KosisError('INVALID_RESPONSE','시설 필드가 중복됩니다.');row[key]=decode(f[2]??'');}return row;});
}
function date(s:string|undefined){if(!s)return null;const v=s.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');const parsed=new Date(v);return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v?v:null;}
export function normalizeChildcareRecord(raw:Record<string,string>,retrievedAt:string):FacilityRecord {
 const full=[raw.sidoname,raw.sigunguname].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();const match=matchSigungu(full);const closed=date(raw.crabldt);
 return {providerFacilityId:raw.stcode||null,facilityType:'어린이집',facilityName:raw.crname??'',status:closed?'CLOSED':raw.crabldt?.trim()?'UNKNOWN':['정상','재개'].includes(raw.crstatusname)?'ACTIVE':raw.crstatusname==='휴지'?'SUSPENDED':'UNKNOWN',address:raw.craddr||null,sido:raw.sidoname||null,sigungu:raw.sigunguname||null,regionCode:match.region?.regionCode??null,normalizationStatus:match.region?.analysisUnit?'MATCHED':'UNRESOLVED',capacity:parsePopulation(raw.crcapat),currentUsers:parsePopulation(raw.crchcnt),openedDate:date(raw.crcnfmdt),closedDate:closed,referenceDate:date(raw.datastdrdt),provider:'CHILDCARE',sourceUrl:source,retrievedAt,dataMode:'LIVE',rawSource:raw};
}
export class ChildcareFacilityProvider implements FacilitySupplyProvider {
 readonly configured:boolean;private cache=new Map<string,{until:number;records:FacilityRecord[]}>();private pending=new Map<string,Promise<FacilityRecord[]>>();private queue:Promise<unknown>=Promise.resolve();private nextAt=0;
 constructor(private key:string,private fetcher:typeof fetch=fetch){this.configured=!!key.trim();}
 getMetadata(){return {provider:'한국사회보장정보원 / 어린이집정보공개포털',dataset:'cpmsapi030',source,frequency:'비정기(수시)',history:'NOT_CONNECTED',license:'공식 API 상세의 이용허락조건 확인 · 출처표시'};}
 async getAvailablePeriods(){return [];}
 async getFacilities(regionCode:string):Promise<FacilityRecord[]>{
  if(!this.configured)throw new KosisError('MISSING_KEY','LIVE VALIDATION BLOCKED — API KEY REQUIRED: CHILDCARE_API_KEY');
  if(!matchSigungu('',regionCode).region?.analysisUnit)throw new KosisError('INVALID_REGION','정규 시군구를 선택해 주세요.');
  const cached=this.cache.get(regionCode);if(cached&&cached.until>Date.now())return structuredClone(cached.records);
  const existing=this.pending.get(regionCode);if(existing)return structuredClone(await existing);
  const work=this.queue.catch(()=>{}).then(async()=>{
   const wait=this.nextAt-Date.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));this.nextAt=Date.now()+1100;
   const url=new URL('https://api.childcare.go.kr/mediate/rest/cpmsapi030/cpmsapi030/request');url.searchParams.set('key',this.key);url.searchParams.set('arcode',regionCode);
   try{const res=await this.fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!res.ok)throw new Error('HTTP');const raw=await res.text();const records=parseChildcareXml(raw.split(this.key).join('[REDACTED]')).map(row=>normalizeChildcareRecord(row,new Date().toISOString()));if(this.cache.size>=32)this.cache.delete(this.cache.keys().next().value!);this.cache.set(regionCode,{until:Date.now()+300000,records});return records;}
   catch(error){if(error instanceof KosisError)throw error;throw new KosisError('REQUEST_FAILED','어린이집 API 요청에 실패했습니다. 연결·인증·응답 형식을 확인해 주세요.');}
  });this.queue=work;this.pending.set(regionCode,work);try{return structuredClone(await work);}finally{this.pending.delete(regionCode);}
 }
 async getFacilitySupplyMetrics(regionCode:string){return aggregateFacilities(await this.getFacilities(regionCode),regionCode);}
}
export const FacilityDataSourceRegistry={어린이집:{provider:'CHILDCARE',dataset:'cpmsapi030',source},노인복지관:null,'청소년 문화센터':null,도서관:null} as const;
