import type { RegionReference } from '../geography/types';
import { normalizeRegion,referencesInText } from '../geography/regionNormalizer';
import type { AdministrativeLevel } from './types';
export function administrativeLevel(text:string,region?:RegionReference|null):AdministrativeLevel {
 if(/(?:[가-힣]+(?:구|시|군)\s+)[가-힣0-9]+(?:읍|면|동)(?=$|[\s,.)]|의|에서|은|는|을|를)/.test(text))return 'EUPMYEONDONG';
 const ref=region??normalizeRegion(text);
 if(ref.normalizationStatus==='national')return 'NATIONAL';
 if(ref.normalizationStatus!=='matched')return 'UNKNOWN';
 return ref.level2||ref.level3?'SIGUNGU':'SIDO';
}
export function explicitScope(scope:string,quote:string):{region:RegionReference|null;level:AdministrativeLevel}{
 const supplied=normalizeRegion(scope);
 if(supplied.normalizationStatus==='national'||supplied.normalizationStatus==='matched')return {region:supplied,level:administrativeLevel(scope,supplied)};
 const found=referencesInText(quote).filter(r=>r.normalizationStatus==='matched'||r.normalizationStatus==='national');
 const unique=[...new Map(found.map(r=>[r.id,r])).values()];
 const leaves=unique.filter(parent=>!unique.some(child=>child.id!==parent.id&&child.displayName.startsWith(`${parent.displayName} `)));
 if(leaves.length!==1)return {region:null,level:administrativeLevel(quote)};
 return {region:leaves[0],level:administrativeLevel(quote,leaves[0])};
}
export function isParent(parent:RegionReference,child:RegionReference){
 return parent.id!==child.id&&parent.level1===child.level1&&(!parent.level2||parent.level2===child.level2)&&!parent.level3;
}
