interface FacilityDefinition {
  name: string;
  aliases: string[];
  category: string;
  users: string[];
  related: string[];
  functions: string[];
  domains: string[];
}
/** Small demonstration catalog, not an exhaustive classification or legal taxonomy. */
export const facilityCatalog: FacilityDefinition[] = [
  { name: '어린이집', aliases: ['어린이집', '보육시설'], category: '보육시설', users: ['영유아'], related: ['영유아 양육가구', '보호자'], functions: ['보육', '돌봄'], domains: ['보육 인프라', '시설 접근성', '돌봄 수요', '지역 인구구조'] },
  { name: '노인복지관', aliases: ['노인복지관', '노인복지센터', '노인복지시설'], category: '노인복지시설', users: ['노인'], related: ['가족', '돌봄 제공자'], functions: ['복지 지원', '여가', '사회적 교류'], domains: ['고령화', '사회적 고립', '복지시설 접근성', '지역 돌봄'] },
  { name: '청소년 문화센터', aliases: ['청소년문화센터', '청소년문화시설', '청소년수련관'], category: '청소년 문화시설', users: ['청소년'], related: ['보호자', '청소년 활동가'], functions: ['문화 활동', '자율 활동', '교류'], domains: ['청소년 활동 공간', '문화 접근성', '여가 수요', '지역 격차'] },
  { name: '도서관', aliases: ['도서관'], category: '도서관', users: ['지역 주민'], related: ['학생', '교육기관'], functions: ['독서', '정보 이용', '학습'], domains: ['정보 접근성', '독서 환경', '학습 공간', '지역 문화 격차'] },
  { name: '공원', aliases: ['공원'], category: '공원·녹지', users: ['지역 주민'], related: ['보행자', '인근 생활권 이용자'], functions: ['휴식', '야외 활동', '교류'], domains: ['녹지 접근성', '생활환경', '야외 여가 수요', '보행 연결성'] },
  { name: '문화시설', aliases: ['문화시설', '문화센터'], category: '문화시설', users: ['지역 주민'], related: ['문화예술인', '문화 활동 단체'], functions: ['문화 활동', '전시', '공연'], domains: ['문화 접근성', '문화 활동 수요', '지역 문화 격차'] },
  { name: '체육시설', aliases: ['체육시설', '체육관', '스포츠센터'], category: '체육시설', users: ['지역 주민'], related: ['생활체육 동호회', '체육 지도자'], functions: ['운동', '생활체육'], domains: ['체육시설 접근성', '건강', '생활체육 수요'] },
  { name: '커뮤니티센터', aliases: ['커뮤니티센터', '커뮤니티공간', '주민공동시설'], category: '지역 공동체 시설', users: ['지역 주민'], related: ['주민 모임', '지역 활동가'], functions: ['교류', '공동체 활동'], domains: ['사회적 연결', '공유 공간', '주민 참여', '생활권 접근성'] },
  { name: '의료시설', aliases: ['의료시설', '병원', '의원', '보건소'], category: '의료시설', users: ['의료서비스 이용자'], related: ['보호자', '의료 종사자'], functions: ['진료', '건강 관리'], domains: ['의료 접근성', '의료서비스 수요', '지역 의료 격차'] },
];
