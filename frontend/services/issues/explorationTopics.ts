import type { FacilityProfile } from '../../evidenceTypes';
import type { ExplorationTopic, PhenomenonCategory } from './types';
export function explorePhenomena(profile: FacilityProfile): ExplorationTopic[] {
  const users=profile.primaryUsers.join(' ') || '이용자'; const facility=profile.facilityName;
  const activity=profile.mainFunctions[0] || facility;
  const rows: [PhenomenonCategory,string,string[]][] = [
    ['SOCIAL','생활 방식과 공동체 관계는 어떻게 달라지는가?',[`${users} 생활 방식 가족구조 변화`,`${activity} 공동체 관계 변화`]],
    ['DEMOGRAPHIC','이용자 인구와 거주지는 어떻게 변화하는가?',[`${users} 인구 변화 지역별 이동`,`${users} 인구 증가 감소 유지`]],
    ['URBAN','도시 개발과 생활권 변화가 관찰되는가?',[`${facility} 주거 산업 개발 생활권 변화`,`${users} 도시 성장 인구 유입 유출`]],
    ['FACILITY','시설 분포·이용·노후화는 어떻게 달라지는가?',[`${facility} 지역별 분포 폐쇄 신설 이용 변화`,`${facility} 노후화 유휴 재사용`]],
    ['SPATIAL','시설 위치와 생활권·이동 경로는 연결되는가?',[`${facility} 접근성 생활권 공간적 분포`,`${facility} 이동 거리 공간 격차`]],
    ['USER','이용·미이용 이유와 활동 요구는 무엇인가?',[`${users} ${facility} 이용 패턴 미이용 이유 조사`,`${facility} 활동 공간 운영시간 요구 설문`]],
    ['POLICY','제도와 운영·공급 정책은 어떻게 변화하는가?',[`${facility} 설치 기준 정책 변화`,`${activity} 운영 제도 지원 정책 변화`]],
    ['ECONOMIC','비용과 운영 여건이 공간 이용에 영향을 주는가?',[`${facility} 운영 비용 이용 부담 변화`]],
    ['ENVIRONMENTAL','환경 조건과 시설 적응 과제는 무엇인가?',[`${facility} 기후 적응 실내외 환경 이용`]],
  ];
  return rows.map(([category,question,queries])=>({id:`topic-${category}`,category,question,queries}));
}
