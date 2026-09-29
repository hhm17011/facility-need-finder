import type {FacilityProfile} from '../../evidenceTypes';
import type {AgeRange,TargetPopulationProfile} from './types';
const source='https://kosis.kr/civilComplaint/qnaDetail.do?boardIdx=22124';
const range=(label:string,minAge:number,maxAge:number|null,definitionSource=source):AgeRange=>({label,minAge,maxAge,definitionSource,configurable:true});
export function targetPopulationProfile(facility:FacilityProfile,override?:AgeRange[]):TargetPopulationProfile {
 let groups:string[]=[];let ages:AgeRange[]=[];
 if(facility.primaryUsers.includes('영유아')){groups=['EARLY_CHILDHOOD'];ages=[range('영유아 분석 범위 · 만 0–5세',0,5)];}
 else if(facility.primaryUsers.includes('노인')){groups=['OLDER_ADULTS'];ages=[range('고령인구 · 만 65세 이상',65,null,'https://kosis.kr/visual/populationKorea/PopulationDashBoardMain.do')];}
 else if(facility.primaryUsers.includes('청소년')){groups=['YOUTH'];ages=[range('청소년 · 만 9–24세',9,24,'https://www.law.go.kr/법령/청소년기본법/제3조')];}
 else if(facility.primaryUsers.includes('지역 주민')){groups=['GENERAL_POPULATION'];}
 if(override){ages=override;groups=['CONFIGURED_GROUP'];}
 for(const a of ages)if(!Number.isInteger(a.minAge)||a.minAge<0||a.minAge>100||(a.maxAge!==null&&(!Number.isInteger(a.maxAge)||a.maxAge<a.minAge||a.maxAge>100)))throw new Error('연령 범위를 확인해 주세요.');
 return {facilityId:facility.facilityName,populationGroups:groups,primaryGroup:groups[0]??'UNCONFIGURED',ageRanges:ages,householdSignals:facility.relatedUsers.filter(s=>/가구|보호자/.test(s)),rationale:groups.length?'만 나이의 명시적 분석 범위입니다. 시설의 법적 입소 자격이나 실제 이용 수요 전체를 의미하지 않습니다. 영유아 0–5세는 프로젝트 분석 설정이며 조정할 수 있습니다.':'연령만으로 이용자 집단을 정의하지 못했습니다. 대상 인구 설정이 필요합니다.',definitionId:JSON.stringify([groups,ages.map(a=>[a.minAge,a.maxAge])])};
}
