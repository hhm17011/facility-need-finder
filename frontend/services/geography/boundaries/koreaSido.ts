import { geoArea, geoConicConformal, geoPath } from 'd3-geo';
import type { Polygon, Position } from 'geojson';
import type { RegionEvidenceProfile, RegionReference } from '../types';
import type { BoundaryCollection, BoundaryFeature, BoundaryProperties } from './types';
// Keys are the source's shapeISO values, not Korean domestic statistical codes.
export const sidoNames: Record<string,string> = {
  'KR-11':'서울특별시','KR-26':'부산광역시','KR-27':'대구광역시','KR-28':'인천광역시',
  'KR-29':'광주광역시','KR-30':'대전광역시','KR-31':'울산광역시','KR-50':'세종특별자치시',
  'KR-41':'경기도','KR-42':'강원특별자치도','KR-43':'충청북도','KR-44':'충청남도',
  'KR-45':'전북특별자치도','KR-46':'전라남도','KR-47':'경상북도','KR-48':'경상남도','KR-49':'제주특별자치도',
};
const historicalNames:Record<string,string>={'강원도':'강원특별자치도','전라북도':'전북특별자치도','제주도':'제주특별자치도'};
const canonicalName=(value:string)=>historicalNames[value.trim()]??value.trim();
export function sidoCode(region:RegionReference):string|null {
  if(region.normalizationStatus!=='matched')return null;
  if(region.regionCode && sidoNames[region.regionCode])return region.regionCode;
  const name=canonicalName(region.level1??region.displayName);
  return Object.keys(sidoNames).find(code=>sidoNames[code]===name)??null;
}
function validRing(ring:unknown):ring is Position[]{
  if(!Array.isArray(ring)||ring.length<4)return false;
  if(!ring.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=124&&p[0]<=133&&p[1]>=32&&p[1]<=40))return false;
  return ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
}
export function parseSidoBoundaries(input:unknown):BoundaryCollection {
  const collection=input as BoundaryCollection;
  if(!collection || collection.type!=='FeatureCollection'||!Array.isArray(collection.features)||collection.features.length!==17)throw new Error('Invalid ADM1 collection');
  const seen=new Set<string>();
  for(const feature of collection.features){
    const props=feature.properties as BoundaryProperties|undefined;
    if(feature.type!=='Feature'||!props||props.shapeGroup!=='KOR'||props.shapeType!=='ADM1'||!sidoNames[props.shapeISO]||seen.has(props.shapeISO))throw new Error('Invalid ADM1 identifier');
    seen.add(props.shapeISO);
    if(!feature.geometry||!['Polygon','MultiPolygon'].includes(feature.geometry.type))throw new Error('Invalid polygon');
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    if(!polygons.length||!polygons.every(p=>Array.isArray(p)&&p.length&&p.every(validRing)))throw new Error('Invalid geographic coordinates');
  }
  return collection;
}
/** d3 spherical paths use clockwise exteriors. Reverse winding only, never move a vertex. */
function orientedPolygon(coordinates:Position[][]):Position[][]{
  const exterior:Polygon={type:'Polygon',coordinates:[coordinates[0]]};
  const reverse=geoArea(exterior)>2*Math.PI;
  return coordinates.map(ring=>reverse?[...ring].reverse():[...ring]);
}
export function projectSidoBoundaries(data:BoundaryCollection){
  const oriented:BoundaryCollection={...data,features:data.features.map(feature=>({...feature,geometry:feature.geometry.type==='Polygon'?{type:'Polygon',coordinates:orientedPolygon(feature.geometry.coordinates)}:{type:'MultiPolygon',coordinates:feature.geometry.coordinates.map(orientedPolygon)}}))};
  const projection=geoConicConformal().parallels([33,38]).rotate([-127.5,0]).center([0,36]).fitExtent([[30,24],[570,586]],oriented);
  const path=geoPath(projection);
  return {projection,features:oriented.features.map(feature=>({feature,path:path(feature)??'',centroid:path.centroid(feature)}))};
}
export function joinSidoEvidence(feature:BoundaryFeature,profiles:RegionEvidenceProfile[]){
  const linked=profiles.filter(profile=>sidoCode(profile.region)===feature.properties.shapeISO&&(!profile.regionalAssessment||profile.regionalAssessment.eligible));
  const direct=linked.find(profile=>!profile.region.level2&&!profile.region.level3);
  const children=linked.filter(profile=>profile.region.level2||profile.region.level3);
  const childScores=children.flatMap(profile=>profile.candidateScore===null?[]:[profile.candidateScore]);
  const signal=direct?.candidateScore??null;
  const childSignal=childScores.length?Math.max(...childScores):null;
  return {code:feature.properties.shapeISO,name:sidoNames[feature.properties.shapeISO],profiles:linked,direct,children,
    evidenceCount:new Set(linked.flatMap(profile=>profile.regionalAssessment?.directEvidenceIds??profile.evidenceItems.map(item=>item.id))).size,
    regionalStatus:linked.some(p=>p.regionalAssessment?.status==='CONFLICTING')?'CONFLICTING':linked.some(p=>p.regionalAssessment?.status==='PARTIALLY_SUPPORTED')?'PARTIALLY_SUPPORTED':linked.some(p=>p.regionalAssessment?.status==='SUPPORTED')?'SUPPORTED':'NEUTRAL',
    coverage:linked.map(p=>p.regionalAssessment).filter(a=>!!a).map(a=>`${a.coverageCount}/${a.coverageTotal}`).join(' · '),
    signal,childSignal,colorSignal:signal??childSignal};
}
