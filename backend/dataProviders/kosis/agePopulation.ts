import {matchSigungu,sigunguReference} from '../../../frontend/services/geography/sigunguRegistry';
import type {TargetPopulationProfile,DemographicMetric} from '../../../frontend/services/demographics/types';
import {parsePopulation,parsePeriod,resolveCanonicalKosisRegion} from './kosisNormalizer';
import {KosisError,textField as t,type KosisMetadata,type KosisRow} from './kosisTypes';
import type {KosisClient} from './kosisClient';
export const agePopulationTable={id:'age-population',orgId:'101',tableId:'DT_1B04006',name:'행정구역(시군구)별/1세별 주민등록인구',metricFamily:'AGE_POPULATION',administrativeLevel:'MIXED' as const,supportedPeriods:['M','Y'] as ('M'|'Y')[],source:'https://kosis.kr/statisticsList/mass/mass_list.jsp?org_id=101&process=statHtml&tbl_id=DT_1B04006',totalItemNames:['총인구수','총 인구수']};
export interface AgePopulationResult {metrics:DemographicMetric[];metadata:KosisMetadata;periods:string[];warnings:string[];retrievedAt:string;coverage:KosisCoverage[]}
export interface KosisCoverage {period:string;rawRecordCount:number;rawRegionCount:number;normalizedSigunguCount:number;unresolvedRegionCount:number;ambiguousRegionCount:number;excludedNonSigunguCount:number}
function age(r:KosisRow){const label=t(r,'ITM_NM').replace(/\s/g,'');const m=label.match(/^(\d+)세(이상)?$/);return m?{min:Number(m[1]),max:m[2]?null:Number(m[1])}:null;}
export function selectAgeCodes(metadata:KosisMetadata,target:TargetPopulationProfile){
 const ageRows=metadata.classifications.filter(r=>Number(t(r,'OBJ_ID_SN'))===2&&t(r,'OBJ_ID')!=='ITEM');
 const totals=ageRows.filter(r=>['계','합계','총계'].includes(t(r,'ITM_NM')));
 if(totals.length!==1)throw new KosisError('INVALID_METADATA','연령 분류의 전체 인구 항목을 확정하지 못했습니다.');
 if(target.primaryGroup==='GENERAL_POPULATION')return {total:totals[0],selected:[totals[0]]};
 if(!target.ageRanges.length)throw new KosisError('TARGET_NOT_CONFIGURED','대상 연령 정의가 필요합니다.');
 const selected=ageRows.filter(r=>{const a=age(r);return a&&target.ageRanges.some(range=>a.min>=range.minAge&&(range.maxAge===null||a.max!==null&&a.max<=range.maxAge));});
 for(const range of target.ageRanges){const end=range.maxAge??99;for(let n=range.minAge;n<=end;n++)if(!selected.some(r=>{const a=age(r)!;return a.min<=n&&(a.max===null||a.max>=n);}))throw new KosisError('MISSING_AGE','요청 연령의 일부가 통계표에 없습니다.');if(range.maxAge===null&&!selected.some(r=>age(r)?.max===null))throw new KosisError('MISSING_AGE','최고 연령 이상 구간을 확인하지 못했습니다.');}
 if(new Set(selected.map(r=>t(r,'ITM_ID'))).size!==selected.length)throw new KosisError('INVALID_METADATA','중복 연령 코드입니다.');
 return {total:totals[0],selected};
}
export function chooseAgePeriods(metadata:KosisMetadata,years=5){
 if(!Number.isInteger(years)||years<1||years>10)throw new KosisError('INVALID_REQUEST','비교 기간은 1~10년입니다.');
 const type=metadata.periods.some(r=>t(r,'PRD_SE')==='M')?'M':'Y';
 const available=[...new Set(metadata.periods.filter(r=>t(r,'PRD_SE')===type&&parsePeriod(t(r,'PRD_DE'),type)).map(r=>t(r,'PRD_DE')))].sort();
 const latest=available.at(-1);if(!latest)throw new KosisError('MISSING_PERIOD','수록 시점이 없습니다.');
 const intended=String(Number(latest.slice(0,4))-years)+latest.slice(4);
 const previous=available.filter(p=>p<latest&&p>=intended&&(type==='Y'||p.slice(4)===latest.slice(4)))[0];
 return {type,periods:previous?[previous,latest]:[latest]};
}
export function normalizeAgePopulation(rows:KosisRow[],metadata:KosisMetadata,target:TargetPopulationProfile,retrievedAt:string,periods:string[],type:string):DemographicMetric[]{
 const codes=selectAgeCodes(metadata,target);const item=metadata.classifications.filter(r=>t(r,'OBJ_ID')==='ITEM'&&agePopulationTable.totalItemNames.includes(t(r,'ITM_NM')));
 if(item.length!==1)throw new KosisError('INVALID_METADATA','성별 합계 인구 항목이 모호합니다.');
 const allowed=new Set([t(codes.total,'ITM_ID'),...codes.selected.map(r=>t(r,'ITM_ID'))]);const groups=new Map<string,KosisRow[]>();
 for(const row of rows){if(t(row,'TBL_ID')!==agePopulationTable.tableId||t(row,'ORG_ID')!=='101'||t(row,'ITM_ID')!==t(item[0],'ITM_ID')||!allowed.has(t(row,'C2'))||!periods.includes(t(row,'PRD_DE'))||t(row,'PRD_SE')!==type||t(row,'TBL_NM').replace(/\s/g,'')!==agePopulationTable.name.replace(/\s/g,'')||Array.from({length:6},(_,n)=>t(row,`C${n+3}`)).some(Boolean))throw new KosisError('INVALID_RESPONSE','연령 인구 응답의 표·분류·시점이 요청과 다릅니다.');
 const key=JSON.stringify([t(row,'C1'),t(row,'PRD_DE')]);groups.set(key,[...(groups.get(key)??[]),row]);}
 const output:DemographicMetric[]=[];
 for(const group of groups.values()){
  const first=group[0];const mapped=resolveCanonicalKosisRegion(first,metadata);const ref=mapped.region?sigunguReference(mapped.region):null;
  for(const [metricType,required] of [['TOTAL_POPULATION',[t(codes.total,'ITM_ID')]],['TARGET_POPULATION',codes.selected.map(r=>t(r,'ITM_ID'))]] as const){
   const cells=required.map(code=>group.filter(r=>t(r,'C2')===code));const complete=cells.every(rs=>rs.length===1&&parsePopulation(rs[0].DT)!==null&&t(rs[0],'UNIT_NM')==='명'&&t(rs[0],'C1_NM')===t(first,'C1_NM'))&&metadata.units.some(r=>t(r,'UNIT_NM')==='명');
   const value=complete?cells.reduce((s,rs)=>s+parsePopulation(rs[0].DT)!,0):null;
   const id=`kosis-age:${t(first,'C1')}:${t(first,'PRD_DE')}:${metricType}:${target.definitionId}`;const date=parsePeriod(t(first,'PRD_DE'),type);
   const limitations=[...(complete?[]:['연령 셀 누락·중복 또는 단위 미확인']),...(ref?[]:['시군구 매핑 미확인']), '과거 행정경계 동일성 미검증'];
   const evidenceIds=cells.flat().map(r=>`kosis:${t(r,'TBL_ID')}:${t(r,'C1')}:${t(r,'C2')}:${t(r,'PRD_DE')}`);
   output.push({facilityType:target.facilityId,metricId:id,metricType,dataMode:value===null?'MISSING':'LIVE',targetDefinition:target.definitionId,dimension:'DEMOGRAPHIC_CHANGE',regionCode:mapped.region?.regionCode??null,regionId:ref?.id??null,regionName:ref?.displayName??mapped.name,administrativeLevel:ref?'SIGUNGU':mapped.context,administrativeUnit:'SIGUNGU_LEAF',value,unit:'명',referenceDate:date,definition:`${agePopulationTable.name}/${metricType}`,populationDefinition:'RESIDENT_REGISTERED_POPULATION_ALL_SEXES',denominator:'NOT_APPLICABLE',boundaryVersion:null,sourceEvidenceId:id,sourceUrl:agePopulationTable.source,sourceExcerpt:`${mapped.name} ${metricType} ${value??'미확인'}명 (${date})`,sourceLocator:`DT_1B04006/C1=${t(first,'C1')}/C2=${required.join('+')}/PRD_DE=${t(first,'PRD_DE')}`,verification:complete&&ref?'source_verified':'unverified',comparisonGroup:null,comparable:false,limitations,derivation:{formula:'sum(exact requested age cells)',inputMetricIds:evidenceIds,sourceEvidenceIds:evidenceIds,startDate:date,endDate:date??'',sourceTables:[agePopulationTable.tableId]},structuredSource:{provider:'KOSIS',mode:'live',tableId:agePopulationTable.tableId,tableName:agePopulationTable.name,organizationId:'101',retrievedAt,providerRegionCode:t(first,'C1'),itemId:t(item[0],'ITM_ID'),periodType:type,normalizationStatus:ref?'MATCHED':matchSigungu(mapped.name).status==='AMBIGUOUS'?'AMBIGUOUS':'UNKNOWN',region:ref??{id:null,regionCode:null,country:'대한민국',level1:null,level2:null,level3:null,displayName:mapped.name,confidence:0,rawText:mapped.name,normalizationStatus:'unknown',possibleCandidates:[]},rawSource:{records:cells.flat()}}});
  }
 }
 return output;
}
export async function fetchAgePopulation(client:KosisClient,metadata:KosisMetadata,target:TargetPopulationProfile,years=5):Promise<AgePopulationResult>{
 const selection=selectAgeCodes(metadata,target);const {periods,type}=chooseAgePeriods(metadata,years);const items=metadata.classifications.filter(r=>t(r,'OBJ_ID')==='ITEM'&&agePopulationTable.totalItemNames.includes(t(r,'ITM_NM')));if(items.length!==1)throw new KosisError('INVALID_METADATA','총인구 항목을 확인하지 못했습니다.');
 const rows:KosisRow[]=[];let retrievedAt='';
 for(const period of periods){const result=await client.request('Param/statisticsParameterData.do',{method:'getList',orgId:'101',tblId:agePopulationTable.tableId,objL1:'ALL',objL2:[...new Set([t(selection.total,'ITM_ID'),...selection.selected.map(r=>t(r,'ITM_ID'))])].join('+'),itmId:t(items[0],'ITM_ID'),prdSe:type,startPrdDe:period,endPrdDe:period});rows.push(...result.rows);retrievedAt=result.retrievedAt;}
 return {metrics:normalizeAgePopulation(rows,metadata,target,retrievedAt,periods,type),coverage:kosisCoverage(rows,metadata),metadata,periods,retrievedAt,warnings:['시군구 원자료의 만 나이 기준입니다. 시설 이용자 수와 다릅니다.','과거 경계 동일성 미검증 지역은 증감 계산을 보류합니다.']};
}

export function kosisCoverage(rows:KosisRow[],metadata:KosisMetadata):KosisCoverage[]{
 return [...new Set(rows.map(r=>t(r,'PRD_DE')))].sort().map(period=>{
 const cells=rows.filter(r=>t(r,'PRD_DE')===period);const regions=[...new Map(cells.map(r=>[t(r,'C1'),r])).values()];
 let unresolvedRegionCount=0,ambiguousRegionCount=0,excludedNonSigunguCount=0;const normalized=new Set<string>();
 for(const row of regions){const mapped=resolveCanonicalKosisRegion(row,metadata);if(mapped.region){normalized.add(mapped.region.regionCode);continue;}
 const match=matchSigungu(mapped.name);
 if(mapped.context==='SIDO'||mapped.context==='NATIONAL'||mapped.name.includes('출장소')||match.region&&!match.region.analysisUnit)excludedNonSigunguCount++;
 else if(match.status==='AMBIGUOUS')ambiguousRegionCount++;else unresolvedRegionCount++;
 }
 return {period,rawRecordCount:cells.length,rawRegionCount:regions.length,normalizedSigunguCount:normalized.size,unresolvedRegionCount,ambiguousRegionCount,excludedNonSigunguCount};
 });
}
