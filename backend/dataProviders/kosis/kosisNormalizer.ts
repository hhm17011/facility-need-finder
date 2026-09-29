import {analysisSigungu,matchSigungu,sigunguReference} from '../../../frontend/services/geography/sigunguRegistry';
import {normalizeRegion} from '../../../frontend/services/geography/regionNormalizer';
import {administrativeLevel} from '../../../frontend/services/regional/administrative';
import type {RegionalMetric} from '../../../frontend/services/regional/types';
import {textField as t,KosisError,type KosisRow,type KosisMetadata,type KosisTableDefinition} from './kosisTypes';
export function parsePopulation(value:unknown):number|null {
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const s=String(value).trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))return null;
 const n=Number(s.replaceAll(',',''));return Number.isSafeInteger(n)&&n>=0?n:null;
}
export function parsePeriod(raw:string,type:string):string|null {
 if(type==='Y'&&/^\d{4}$/.test(raw))return raw;
 if(type==='M'&&/^\d{6}$/.test(raw)&&Number(raw.slice(4))>=1&&Number(raw.slice(4))<=12)return `${raw.slice(0,4)}-${raw.slice(4)}`;
 return null;
}
/** Follow explicit metadata parent links only. Never infer parents from code prefixes/order. */
export function resolveKosisRegion(row:KosisRow,metadata:KosisMetadata){
 const canonical=resolveCanonicalKosisRegion(row,metadata);
 if(canonical.region)return {region:sigunguReference(canonical.region),sourceName:canonical.name,level:'SIGUNGU' as const};
 const name=t(row,'C1_NM');const code=t(row,'C1');const names=[name];const seen=new Set<string>([code]);
 let entries=metadata.classifications.filter(r=>t(r,'OBJ_ID')!=='ITEM'&&t(r,'OBJ_ID_SN')==='1'&&t(r,'ITM_ID')===code);
 const classificationId=entries.length===1?t(entries[0],'OBJ_ID'):'';
 let entry=entries.length===1?entries[0]:undefined;
 if(entry&&t(entry,'ITM_NM')!==name)entry=undefined;
 for(let depth=0;entry&&depth<6;depth++){
  const parent=t(entry,'UP_ITM_ID');if(!parent||seen.has(parent))break;seen.add(parent);
  entries=metadata.classifications.filter(r=>t(r,'OBJ_ID')===classificationId&&t(r,'ITM_ID')===parent);
  if(entries.length!==1)break;entry=entries[0];const parentName=t(entry,'ITM_NM');if(!parentName||parentName==='전국')break;
  names.unshift(parentName);
 }
 const full=[...new Set(names)].join(' ');const withParent=normalizeRegion(full);
 // Explicit parent context may not be discarded to make a conflicting child alias match.
 const region=names.length>1?withParent:normalizeRegion(name);
 return {region,sourceName:full,level:administrativeLevel(full,region)};
}
export function normalizeKosisRows(rows:KosisRow[],table:KosisTableDefinition,metadata:KosisMetadata,retrievedAt:string,itemId:string,periodType:string,periods:string[]):RegionalMetric[]{
 const normalizedTitle=(s:string)=>s.replace(/[\s,]/g,'');
 const tableNames=new Set(metadata.table.map(r=>normalizedTitle(t(r,'TBL_NM'))));
 return rows.map((row,index)=>{
  if(t(row,'ORG_ID')!==table.orgId||t(row,'TBL_ID')!==table.tableId||!tableNames.has(normalizedTitle(t(row,'TBL_NM')))||t(row,'ITM_ID')!==itemId||!table.totalItemNames.includes(t(row,'ITM_NM')))throw new KosisError('INVALID_RESPONSE','KOSIS 통계표·기관·총인구 항목이 요청과 다릅니다.');
  if(t(row,'PRD_SE')!==periodType||!periods.includes(t(row,'PRD_DE')))throw new KosisError('INVALID_RESPONSE','KOSIS 응답 시점이 요청과 다릅니다.');
  if(Array.from({length:7},(_,i)=>t(row,`C${i+2}`)).some(Boolean))throw new KosisError('INVALID_RESPONSE','등록되지 않은 추가 분류가 있는 통계표입니다.');
  const value=parsePopulation(row.DT);const referenceDate=parsePeriod(t(row,'PRD_DE'),periodType);
  const {region,sourceName,level}=resolveKosisRegion(row,metadata);const unit=t(row,'UNIT_NM')||null;
  const limitations:string[]=[];
  if(value===null)limitations.push('인구 값이 없거나 유효한 비음수 정수가 아닙니다.');
  if(!referenceDate)limitations.push('기준 시점 미확인');
  if(unit!=='명'||!metadata.units.some(r=>t(r,'UNIT_NM')===unit))limitations.push('인구 단위 명 확인이 필요합니다.');
  if(!t(row,'C1')||!t(row,'C1_NM'))limitations.push('지역 코드 또는 이름이 없습니다.');
  if(!['matched','national'].includes(region.normalizationStatus))limitations.push('지역 정규화 미확인 · 임의 지역에 연결하지 않습니다.');
  const verified=limitations.length===0;
  // KOSIS classifications are provider codes; boundary revisions are not supplied by this metadata contract.
  limitations.push('행정 경계 버전 미확인 · 지역 간/시계열 비교 보류');
  const sourceEvidenceId=`kosis:${table.orgId}:${table.tableId}:${t(row,'C1')}:${itemId}:${t(row,'PRD_DE')}`;
  return {metricId:`${sourceEvidenceId}:${index}`,metricType:'TOTAL_POPULATION',dimension:'DEMOGRAPHIC_CHANGE',regionCode:region.regionCode,regionId:region.id,regionName:region.normalizationStatus==='matched'?region.displayName:sourceName,administrativeLevel:level,administrativeUnit:region.level3||region.level2?.endsWith('구')?'DISTRICT':region.level2?'CITY_COUNTY':level,value,unit,referenceDate,definition:`${t(row,'TBL_NM')} / ${t(row,'ITM_NM')}`,populationDefinition:`${table.tableId}:${itemId}:${t(row,'ITM_NM')}`,denominator:'NOT_APPLICABLE',boundaryVersion:null,sourceEvidenceId,sourceUrl:table.source,sourceExcerpt:`${sourceName} ${t(row,'ITM_NM')} ${String(row.DT??'미제공')} ${unit??''} (${t(row,'PRD_DE')})`,sourceLocator:`${table.tableId} / C1=${t(row,'C1')} / ITM_ID=${itemId} / PRD_DE=${t(row,'PRD_DE')}`,verification:verified?'source_verified':'unverified',comparisonGroup:null,comparable:false,limitations,structuredSource:{provider:'KOSIS',mode:'live',tableId:table.tableId,tableName:t(row,'TBL_NM'),organizationId:table.orgId,retrievedAt,providerRegionCode:t(row,'C1')||null,itemId,periodType,normalizationStatus:region.normalizationStatus==='matched'?'MATCHED':region.normalizationStatus==='national'?'NATIONAL':region.normalizationStatus==='ambiguous'?'AMBIGUOUS':'UNKNOWN',region,rawSource:structuredClone(row)}};
 });
}

export function resolveCanonicalKosisRegion(row:KosisRow,metadata:KosisMetadata){
 const names=[t(row,'C1_NM')];let entry=metadata.classifications.find(r=>Number(t(r,'OBJ_ID_SN'))===1&&t(r,'ITM_ID')===t(row,'C1'));const direct=entry;const seen=new Set<string>();
 while(entry&&t(entry,'UP_ITM_ID')&&!seen.has(t(entry,'UP_ITM_ID'))){const code=t(entry,'UP_ITM_ID');seen.add(code);entry=metadata.classifications.find(r=>t(r,'OBJ_ID')===t(entry!,'OBJ_ID')&&t(r,'ITM_ID')===code);if(!entry||t(entry,'ITM_NM')==='전국')break;const parent=t(entry,'ITM_NM');if(!names[0].startsWith(parent+' '))names.unshift(parent);}
 // KOSIS can omit the parent city (e.g. Giheung -> Gyeonggi). Resolve by
 // unique leaf name AND explicit province context; never infer code semantics.
 if(!direct||t(direct,'ITM_NM')!==t(row,'C1_NM'))return {name:names.join(' '),region:null,context:'UNKNOWN' as const};
 if(!t(direct,'UP_ITM_ID')&&names.length===1)return {name:names[0],region:null,context:names[0]==='전국'?'NATIONAL' as const:/^(?:[^ ]+도|[^ ]+광역시|[^ ]+특별시|세종특별자치시)$/.test(names[0])?'SIDO' as const:'UNKNOWN' as const};
 const candidates=analysisSigungu.filter(r=>r.name===t(row,'C1_NM')&&names.includes(r.parentSidoName));
 if(candidates.length===1)return {name:candidates[0].fullName,region:candidates[0],context:'UNKNOWN' as const};
 const name=names.join(' ');if(name==='전국'||/^(?:[^ ]+도|[^ ]+광역시|[^ ]+특별시|세종특별자치시)$/.test(name))return {name,region:null,context:name==='전국'?'NATIONAL' as const:'SIDO' as const};
 const matched=matchSigungu(name);return {name,region:matched.region?.analysisUnit?matched.region:null,context:'UNKNOWN' as const};
}
