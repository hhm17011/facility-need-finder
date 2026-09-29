import type {DemographicMetric,RelativePosition} from '../demographics/types';

export type FacilityNeedClass='HIGH_DEMAND_LOW_SUPPLY'|'HIGH_DEMAND_NORMAL_SUPPLY'|'NORMAL_DEMAND_LOW_SUPPLY'|'NORMAL'|'INSUFFICIENT_DATA';
export interface RegionalFacilitySupply {
 regionCode:string;regionName:string;facilityType:string;facilityCount:number|null;
 supplyMetricType?:'FACILITIES_PER_1000_CHILDREN';supplyValue?:number;supplyUnit?:string;
 facilitiesPer100k:number|null;targetPopulationPerFacility:number|null;
 verificationStatus:'SOURCE_VERIFIED'|'PARTIAL'|'UNKNOWN';
 source:{provider:string;dataset:string;period:string|null;rowPeriodStart:string|null;rowPeriodEnd:string|null;url:string;retrievedAt:string};
 recordIds:string[];limitations:string[];
}
export interface FacilityNeedRegion {
 regionCode:string;regionName:string;demand:{targetPopulation:number;percentile:number;period:string;metricId:string};
 supply:RegionalFacilitySupply;comparison:{facilitiesPer100kPercentile:number;cohortSize:number};
 classification:FacilityNeedClass;explanation:string;
}
const percentile=(value:number,values:number[])=>100*(values.filter(v=>v<value).length+values.filter(v=>v===value).length/2)/values.length;
export function compareFacilityNeed(demandRows:{metric:DemographicMetric;position:RelativePosition}[],supply:RegionalFacilitySupply[]):FacilityNeedRegion[]{
 const joined=supply.flatMap(row=>{const demand=demandRows.find(entry=>entry.metric.regionCode===row.regionCode&&entry.metric.metricType==='TARGET_POPULATION'&&entry.metric.dataMode==='LIVE'&&entry.metric.value!==null);const d=demand?.metric,p=demand?.position;if(!d||!p||d.value!<=0||row.verificationStatus==='UNKNOWN')return [];if(row.supplyMetricType==='FACILITIES_PER_1000_CHILDREN'){if(row.supplyValue===undefined||!Number.isFinite(row.supplyValue)||row.supplyValue<0)return [];return [{row,d,p,supplyValue:row.supplyValue}];}if(row.facilityCount===null||row.facilityCount<=0)return [];const per100k=row.facilityCount/d.value!*100000;return [{row:{...row,facilitiesPer100k:per100k,targetPopulationPerFacility:d.value!/row.facilityCount},d,p,supplyValue:per100k}];});
 const supplyValues=joined.map(v=>v.supplyValue);
 return joined.map(({row,d,p,supplyValue})=>{const supplyPercentile=percentile(supplyValue,supplyValues);const highDemand=p.percentile>=75,lowSupply=supplyPercentile<=25;const classification:FacilityNeedClass=highDemand&&lowSupply?'HIGH_DEMAND_LOW_SUPPLY':highDemand?'HIGH_DEMAND_NORMAL_SUPPLY':lowSupply?'NORMAL_DEMAND_LOW_SUPPLY':'NORMAL';const explanation=classification==='HIGH_DEMAND_LOW_SUPPLY'?'대상인구는 상위 25%이고 인구 대비 시설 공급은 하위 25%입니다.':classification==='HIGH_DEMAND_NORMAL_SUPPLY'?'대상인구는 상위 25%이지만 인구 대비 시설 공급은 하위 25%가 아닙니다.':classification==='NORMAL_DEMAND_LOW_SUPPLY'?'대상인구는 상위 25%가 아니지만 인구 대비 시설 공급은 하위 25%입니다.':'수요·공급 어느 쪽도 V1 극단 구간에 해당하지 않습니다.';return {regionCode:row.regionCode,regionName:row.regionName,demand:{targetPopulation:d.value!,percentile:p.percentile,period:d.referenceDate!,metricId:d.metricId},supply:row,comparison:{facilitiesPer100kPercentile:supplyPercentile,cohortSize:joined.length},classification,explanation};}).sort((a,b)=>{const order:Record<FacilityNeedClass,number>={HIGH_DEMAND_LOW_SUPPLY:0,NORMAL_DEMAND_LOW_SUPPLY:1,HIGH_DEMAND_NORMAL_SUPPLY:2,NORMAL:3,INSUFFICIENT_DATA:4};return order[a.classification]-order[b.classification]||b.demand.percentile-a.demand.percentile||a.comparison.facilitiesPer100kPercentile-b.comparison.facilitiesPer100kPercentile||a.regionCode.localeCompare(b.regionCode);});
}
