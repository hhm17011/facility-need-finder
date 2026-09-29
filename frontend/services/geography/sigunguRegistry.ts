import raw from '../../../data/geography/sigungu/registry.json';
import metadata from '../../../data/geography/sigungu/metadata.json';
import type {RegionReference} from './types';
export const PRIMARY_ANALYSIS_LEVEL='SIGUNGU' as const;
export interface Sigungu {regionCode:string;legalCode:string;name:string;fullName:string;level:'SIGUNGU';parentSidoCode:string;parentSidoName:string;parentCityCode:string|null;status:'ACTIVE'|'RETIRED';analysisUnit:boolean}
export const sigunguRegistry=raw as Sigungu[];
export const analysisSigungu=sigunguRegistry.filter(r=>r.analysisUnit);
export const registryMetadata=metadata;
export function matchSigungu(name:string,code?:string){
 const clean=name.normalize('NFC').replace(/\s+/g,' ').trim();
 const compact=(s:string)=>s.replace(/\s/g,'');
 const matches=sigunguRegistry.filter(r=>r.status==='ACTIVE'&&(code?r.regionCode===code:compact(r.fullName)===compact(clean)||compact(r.fullName.split(' ').slice(1).join(' '))===compact(clean)||r.name===clean));
 if(matches.length!==1)return {status:matches.length>1||['중구','서구','동구','남구','북구'].includes(clean)?'AMBIGUOUS' as const:'UNRESOLVED' as const,region:null};
 const region=matches[0];if(code&&clean&&![region.fullName,region.name,region.fullName.split(' ').slice(1).join(' ')].includes(clean))return {status:'UNRESOLVED' as const,region:null};
 return {status:'MATCHED' as const,region};
}
export function sigunguReference(region:Sigungu):RegionReference {
 const parts=region.fullName.split(' ');return {id:`sigungu:${region.regionCode}`,regionCode:region.regionCode,country:'대한민국',level1:region.parentSidoName,level2:parts[1]??region.name,level3:parts[2]??null,displayName:region.fullName,confidence:1,rawText:region.fullName,normalizationStatus:'matched',possibleCandidates:[]};
}
