import {fetchAgePopulation} from './agePopulation';
import type {RegionalDataProvider,RegionalDataRequest,RegionalDataResult} from '../../../frontend/services/dataProviders/types';
import {KosisClient} from './kosisClient';
import {KosisTableRegistry} from './kosisTables';
import {KosisError,textField as t,type KosisMetadata} from './kosisTypes';
import {normalizeKosisRows,parsePeriod} from './kosisNormalizer';
export class KosisProvider implements RegionalDataProvider {
 readonly id='KOSIS';get configured(){return this.client.configured;}
 constructor(private client:KosisClient,readonly registry=new KosisTableRegistry()){}
 async getMetadata(id='total-population'):Promise<KosisMetadata & Record<string,unknown>>{
  const table=this.registry.get(id);const base={method:'getMeta',orgId:table.orgId,tblId:table.tableId};
  const result={} as KosisMetadata & Record<string,unknown>;
  for(const [key,type] of [['table','TBL'],['organization','ORG'],['periods','PRD'],['classifications','ITM'],['units','UNIT']] as const){
   const params:Record<string,string>={...base,type};if(type==='PRD')params.detail='Y';if(type==='ITM'){params.objId='';params.itmId='';}
   try{result[key]=(await this.client.request('statisticsData.do',params)).rows;}
   catch(error){
    // Some live tables have units on ITEM metadata but no standalone UNIT response.
    if(type!=='UNIT'||!(error instanceof KosisError)||error.upstreamCode!=='30')throw error;
    result.units=result.classifications.filter(r=>t(r,'OBJ_ID')==='ITEM'&&t(r,'UNIT_NM')).map(r=>({UNIT_NM:t(r,'UNIT_NM'),UNIT_ID:t(r,'UNIT_ID'),metadataSource:'ITM'}));
    if(!result.units.length)throw error;
   }
   if(type==='PRD'){result.rawPeriods=result.periods;result.periods=normalizeKosisPeriods(result.periods);}
  }
  const normalize=(s:string)=>s.replace(/[\s,]/g,'');
  if(!result.table.some(r=>normalize(t(r,'TBL_NM'))===normalize(table.name)))throw new KosisError('INVALID_METADATA','등록한 KOSIS 통계표 이름과 메타데이터가 다릅니다.');
  return result;
 }
 /** Discovery is bounded and does not automatically register or trust returned tables. */
 async discoverTables(search:string){
  if(!search.trim()||search.length>80)throw new KosisError('INVALID_REQUEST','검색어 길이를 확인해 주세요.');
  return this.client.request('statisticsSearch.do',{method:'getList',searchNm:search,sort:'RANK',startCount:'1',resultCount:'10'});
 }
 async getPopulation(request:RegionalDataRequest={}):Promise<RegionalDataResult>{
  const table=this.registry.get(request.table);const metadata=await this.getMetadata(table.id);
  const items=metadata.classifications.filter(r=>t(r,'OBJ_ID')==='ITEM'&&table.totalItemNames.includes(t(r,'ITM_NM')));
  if(items.length!==1||!t(items[0],'ITM_ID'))throw new KosisError('INVALID_METADATA','총인구 항목 코드를 메타데이터에서 확정하지 못했습니다.');
  const periodType=request.periodType??(metadata.periods.some(r=>t(r,'PRD_SE')==='M')?'M':'Y');
  if(!table.supportedPeriods.includes(periodType))throw new KosisError('MISSING_PERIOD','등록되지 않은 수록주기입니다.');
  const available=[...new Set(metadata.periods.filter(r=>t(r,'PRD_SE')===periodType&&parsePeriod(t(r,'PRD_DE'),periodType)).map(r=>t(r,'PRD_DE')))].sort();
  const count=request.latestCount??2;
  if(!Number.isInteger(count)||count<1||count>6)throw new KosisError('INVALID_REQUEST','최근 시점은 1~6개까지 조회합니다.');
  const periods=request.periods?[...new Set(request.periods)].sort():available.slice(-count);
  if(!periods.length||periods.length>6||periods.some(p=>!available.includes(p)))throw new KosisError('MISSING_PERIOD','메타데이터에서 요청 시점을 확인하지 못했습니다.');
  // Range query only when the verified range contains no unrequested periods.
  const interval=available.filter(p=>p>=periods[0]&&p<=periods.at(-1)!);
  if(interval.length!==periods.length)throw new KosisError('INVALID_REQUEST','수록 시점 목록에서 연속된 최대 6개 시점을 선택해 주세요.');
  const itemId=t(items[0],'ITM_ID');
  const response=await this.client.request('Param/statisticsParameterData.do',{method:'getList',orgId:table.orgId,tblId:table.tableId,objL1:'ALL',itmId:itemId,prdSe:periodType,startPrdDe:periods[0],endPrdDe:periods.at(-1)!});
  const metrics=normalizeKosisRows(response.rows,table,metadata,response.retrievedAt,itemId,periodType,periods);
  const warnings:string[]=[];
  for(const period of periods)if(!response.rows.some(row=>t(row,'PRD_DE')===period))warnings.push(`요청 시점 ${period}의 응답 자료가 없습니다.`);
  if(metrics.some(m=>!m.regionId))warnings.push('정규 지역 사전에 없는 지역은 원본을 보존하고 지도·순위 연결에서 제외합니다.');
  warnings.push('시설 공급 데이터 필요','행정 경계 버전 미확인: 시계열 증감과 지역 비교는 보류합니다.');
  return {provider:this.id,metrics,metadata:{...metadata,request:{tableId:table.tableId,periodType,periods,itemId}},retrievedAt:response.retrievedAt,warnings,agePopulationStatus:'NOT_CONFIGURED'};
 }
 getRegionalMetrics(request?:RegionalDataRequest){return this.getPopulation(request);}
 async getPopulationByAge(request?:RegionalDataRequest){
  if(!request?.target)return {status:'NOT_CONFIGURED' as const};
  return fetchAgePopulation(this.client,await this.getMetadata('age-population'),request.target,request.windowYears);
 }
}

/** Live PRD metadata uses period-heading rows followed by dotted dates. Preserve raw metadata separately. */
export function normalizeKosisPeriods(rows:import('./kosisTypes').KosisRow[]){
 let current='';const output:import('./kosisTypes').KosisRow[]=[];
 for(const row of rows){const heading=t(row,'PRD_SE');if(heading)current=({'월':'M','년':'Y','연':'Y',M:'M',Y:'Y'} as Record<string,string>)[heading]??'';
 const raw=t(row,'PRD_DE');const period=current==='M'?raw.replace(/^(\d{4})\.(\d{2})$/,'$1$2'):raw;
 if(parsePeriod(period,current))output.push({...row,PRD_SE:current,PRD_DE:period});}
 return output;
}
