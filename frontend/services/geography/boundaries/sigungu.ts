import {analysisSigungu} from '../sigunguRegistry';
import type {RegionEvidenceProfile} from '../types';
import type {BoundaryCollection} from './types';
export type SigunguLayer='TARGET_POPULATION'|'TARGET_POPULATION_SHARE'|'TARGET_POPULATION_CHANGE'|'TARGET_POPULATION_CHANGE_RATE'|'FACILITY_COUNT'|'TOTAL_CAPACITY'|'FACILITIES_PER_1000_TARGET_POPULATION'|'CAPACITY_PER_1000_TARGET_POPULATION'|'ISSUE_SIGNAL';
export const sigunguLayerLabels:Record<SigunguLayer,string>={TARGET_POPULATION:'대상인구',TARGET_POPULATION_SHARE:'대상인구 비율',TARGET_POPULATION_CHANGE:'대상인구 변화',TARGET_POPULATION_CHANGE_RATE:'대상인구 변화율',FACILITY_COUNT:'시설 수',TOTAL_CAPACITY:'시설 정원',FACILITIES_PER_1000_TARGET_POPULATION:'대상인구 1,000명당 시설',CAPACITY_PER_1000_TARGET_POPULATION:'대상인구 1,000명당 정원',ISSUE_SIGNAL:'선택 이슈 신호'};
export function sigunguLayerValue(profile:RegionEvidenceProfile|undefined,layer:SigunguLayer):number|null{
 if(!profile||profile.mode!=='live'||!profile.region.regionCode||!analysisSigungu.some(r=>r.regionCode===profile.region.regionCode))return null;
 if(layer==='ISSUE_SIGNAL')return profile.candidateScore;
 if(layer==='FACILITIES_PER_1000_TARGET_POPULATION'||layer==='CAPACITY_PER_1000_TARGET_POPULATION'){const m=profile.demandSupplyIndicators?.find(m=>m.type===layer&&m.dataMode==='LIVE');return m?.value??null;}
 if(layer==='FACILITY_COUNT'||layer==='TOTAL_CAPACITY'){const m=profile.facilitySupplyMetrics?.filter(m=>m.metricType===layer&&m.dataMode==='LIVE'&&!m.limitations.length).sort((a,b)=>(b.referenceDate??'').localeCompare(a.referenceDate??''))[0];return m?.value??null;}
 const m=profile.demographicMetrics?.find(m=>m.metricType===layer&&m.dataMode==='LIVE'&&m.verification==='source_verified'&&m.administrativeLevel==='SIGUNGU');return m?.value??null;
}
export function parseSigunguBoundaries(input:unknown):BoundaryCollection {
 const data=input as {type:string;features:{type:string;geometry:BoundaryCollection['features'][number]['geometry'];properties:{regionCode:string;fullName:string;boundaryDate:string}}[]};
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw new Error('Invalid SIGUNGU geometry');const seen=new Set<string>();
 const features=data.features.map(f=>{const p=f.properties;const canonical=analysisSigungu.find(r=>r.regionCode===p?.regionCode);
 if(f.type!=='Feature'||!canonical||canonical.fullName!==p.fullName||p.boundaryDate!=='2026-07-01'||seen.has(p.regionCode))throw new Error('Invalid SIGUNGU join');seen.add(p.regionCode);
 if(!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type))throw new Error('Invalid boundary');
 const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 if(!polygons.every(polygon=>polygon.length&&polygon.every(ring=>ring.length>=4&&ring.every(point=>point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&point[0]>=124&&point[0]<=133&&point[1]>=32&&point[1]<=40)&&ring[0][0]===ring.at(-1)![0]&&ring[0][1]===ring.at(-1)![1])))throw new Error('Invalid coordinates');
 return {type:'Feature' as const,geometry:f.geometry,properties:{shapeName:p.fullName,shapeISO:p.regionCode,shapeID:p.regionCode,shapeGroup:'KOR',shapeType:'ADM2'}};
 });return {type:'FeatureCollection',features};
}
