import type {FacilityProfile} from '../../evidenceTypes';
import type {TargetPopulationProfile} from '../demographics/types';

export type IndicatorAvailability='AVAILABLE'|'FACILITY_SPECIFIC_ONLY'|'NOT_CONNECTED';
export interface FacilityIndicatorSpec {
 id:string; label:string; role:'SELECTION'|'VALIDATION'; availability:IndicatorAvailability;
 source:string|null; reason:string;
}
export interface FacilityIndicatorPlan {
 facility:string; indicators:FacilityIndicatorSpec[];
 regionSelectionStatus:'COMPARISON_ONLY'|'PARTIAL';
 selectionExplanation:string;
}

/** Declares what the current pipeline can actually measure. It never substitutes one indicator for another. */
export function facilityIndicatorPlan(profile:FacilityProfile,target:TargetPopulationProfile):FacilityIndicatorPlan {
 const populationLabel=target.primaryGroup==='OLDER_ADULTS'?'65세 이상 인구':target.primaryGroup==='YOUTH'?'9–24세 인구':target.primaryGroup==='EARLY_CHILDHOOD'?'0–5세 인구':'총인구';
 const population:FacilityIndicatorSpec={id:'TARGET_POPULATION',label:populationLabel,role:'SELECTION',availability:'AVAILABLE',source:'KOSIS DT_1B04006',reason:'시설 이용 수요가 아니라 명시된 연령 범위의 잠재 인구 규모를 비교합니다.'};
 const supplyConfigured=profile.facilityName==='어린이집';
 const supply:FacilityIndicatorSpec={id:supplyConfigured?'FACILITIES_PER_1000_CHILDREN':'FACILITY_COUNT',label:supplyConfigured?'유아 천 명당 보육시설 수':profile.facilityName+' 시설 수',role:'VALIDATION',availability:supplyConfigured?'AVAILABLE':'NOT_CONNECTED',source:supplyConfigured?'KOSIS DT_1YL20951':null,reason:supplyConfigured?'0–5세 주민등록인구 대비 보육시설 수로 전국 시군구 공급 수준을 비교합니다.':'검증된 시군구별 공급 데이터가 현재 연결되어 있지 않습니다.'};
 const accessibility:FacilityIndicatorSpec={id:'ACCESSIBILITY',label:'공간 접근성',role:'VALIDATION',availability:'NOT_CONNECTED',source:null,reason:'좌표·이동시간·생활권 자료가 연결되어 있지 않습니다.'};
 return {facility:profile.facilityName,indicators:[population,supply,accessibility],regionSelectionStatus:supplyConfigured?'PARTIAL':'COMPARISON_ONLY',selectionExplanation:supplyConfigured?'0–5세 인구와 유아 천 명당 보육시설 수를 각각 비교합니다. 상·하위 25%는 조정 가능한 비교 기준입니다.':'현재 지역 배열은 '+populationLabel+'의 동일시점 전국 비교입니다. '+profile.facilityName+' 필요도·공급 부족·입지 추천 순위가 아닙니다.'};
}
