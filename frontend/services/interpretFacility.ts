import { facilityCatalog } from '../data/facilityCatalog';
import type { FacilityInterpreter, FacilityProfile } from '../evidenceTypes';

function researchFields(name:string,users:string[],functions:string[],domains:string[]){
  const stem=name.replace(/복합|공공|지역/g,'').trim()||name;const target=users.length?users:['지역 주민'];const activity=functions.length?functions:[stem];
  return {normalizedConcepts:[...new Set([name,stem,`${stem} 시설`])],targetUsers:target,relatedFacilityTerms:[...new Set([name,stem,...activity])],demographicConcepts:[`${target[0]} 인구 변화`,'생활권 인구'],socialConcepts:[`${target[0]} 이용 수요`,...domains.slice(0,2),'지역 공동체'],spatialConcepts:[`${stem} 접근성`,`${stem} 지역 격차`,'생활권'],policyConcepts:[`${stem} 설치·운영 계획`,'생활SOC'],demandConcepts:[`${stem} 수요`,`${target[0]} 이용 요구`],supplyConcepts:[`${stem} 시설 분포`,`${stem} 공급 수준`],researchQuestions:[`${stem}의 지역 격차가 존재하는가?`,`${target[0]} 규모와 ${stem} 공급 사이 불일치가 있는가?`,`${stem} 접근성이 낮다고 보고된 지역은 어디인가?`]};
}

export const interpretFacility: FacilityInterpreter = async (input) => {
  const originalInput = input.trim().replace(/\s+/g, ' ');
  if (!originalInput) throw new Error('계획하고 있는 시설을 입력해 주세요.');
  const compact = originalInput.replace(/\s/g, '');
  let matches = facilityCatalog.filter((entry) => entry.aliases.some((alias) => compact.includes(alias)));
  // Prefer a specific youth profile over its overlapping generic culture alias.
  if (/청소년/.test(compact) && matches.some((entry) => entry.category.includes('문화'))) {
    matches = matches.filter((entry) => !entry.category.includes('문화'));
    matches.push(facilityCatalog[2]);
  }
  if (matches.length !== 1) {
    const fields=researchFields(originalInput,[],[],['이용자 수요','시설 접근성','지역 여건']);return {
      originalInput, facilityName: originalInput, facilityCategory: '분류 확인 필요',
      primaryUsers: ['지역 주민'], relatedUsers: [], mainFunctions: [originalInput],
      problemDomains: ['이용자 수요', '시설 접근성', '지역 여건'],
      interpretationStatus: 'needs_clarification', interpretationMethod: 'local_rules',
      interpretationNote: matches.length > 1
        ? '여러 시설 유형이 감지되었습니다. 주된 시설과 이용자를 구체화해 주세요. 아래는 입력을 바탕으로 만든 임시 탐색 계획입니다.'
        : '등록된 시설 유형과 일치하지 않습니다. 입력 개념을 보존해 지역 수요·접근성·공급 맥락을 탐색합니다.',
      ...fields,
    };
  }
  const definition = matches[0];
  const profile: FacilityProfile = {
    originalInput, facilityName: definition.name, facilityCategory: definition.category,
    primaryUsers: [...definition.users], relatedUsers: [...definition.related],
    mainFunctions: [...definition.functions], problemDomains: [...definition.domains],
    interpretationStatus: 'matched', interpretationMethod: 'local_rules',
    interpretationNote: '로컬 규칙으로 해석한 초안입니다. 설계 의도에 맞는지 확인해 주세요.',
    ...researchFields(definition.name,[...definition.users],[...definition.functions],[...definition.domains]),
  };
  // Preserve explicit audience qualifiers without turning every facility into a welfare center.
  if (/노인|어르신|고령자/.test(compact) && definition.name !== '노인복지관') {
    profile.primaryUsers = ['노인'];
    profile.relatedUsers = [...new Set([...profile.relatedUsers, '가족', '돌봄 제공자'])];
    profile.problemDomains = [...new Set([...profile.problemDomains, '고령자 접근성', '사회적 고립'])];
  } else if (/청소년/.test(compact)) {
    profile.primaryUsers = ['청소년'];
  }
  return profile;
};
