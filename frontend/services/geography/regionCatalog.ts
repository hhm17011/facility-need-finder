interface Entry { id: string; level1: string; level2: string | null; level3: string | null; aliases: string[] }
const entry = (id: string, level1: string, level2: string | null, level3: string | null, aliases: string[]): Entry => ({ id, level1, level2, level3, aliases: [...new Set([[level1, level2, level3].filter(Boolean).join(' '), ...aliases])] });
// Small, explicit naming dictionary. Keys are not official administrative codes.
// Naming references: official city portals, documented in docs/GEOGRAPHIC_MAPPING.md.
export const regionCatalog: Entry[] = [
  entry('seoul', '서울특별시', null, null, ['서울']),
  entry('busan', '부산광역시', null, null, ['부산']),
  entry('daegu', '대구광역시', null, null, ['대구']),
  entry('incheon', '인천광역시', null, null, ['인천']),
  entry('gwangju-metro', '광주광역시', null, null, ['광주']),
  entry('daejeon', '대전광역시', null, null, ['대전']),
  entry('ulsan', '울산광역시', null, null, ['울산']),
  entry('sejong', '세종특별자치시', null, null, ['세종시', '세종']),
  entry('gyeonggi', '경기도', null, null, ['경기']),
  entry('gangwon', '강원특별자치도', null, null, ['강원도', '강원']),
  entry('chungbuk', '충청북도', null, null, ['충북']),
  entry('chungnam', '충청남도', null, null, ['충남']),
  entry('jeonbuk', '전북특별자치도', null, null, ['전라북도', '전북']),
  entry('jeonnam', '전라남도', null, null, ['전남']),
  entry('gyeongbuk', '경상북도', null, null, ['경북']),
  entry('gyeongnam', '경상남도', null, null, ['경남']),
  entry('jeju', '제주특별자치도', null, null, ['제주도', '제주']),
  entry('gwangju-buk', '광주광역시', '북구', null, ['광주광역시 북구', '광주 북구', '북구']),
  entry('gyeonggi-gwangju', '경기도', '광주시', null, ['경기 광주시', '경기도 광주', '광주시', '광주']),
  entry('yongin', '경기도', '용인시', null, ['용인시', '용인', '용인특례시']),
  entry('yongin-giheung', '경기도', '용인시', '기흥구', ['용인시 기흥구', '용인 기흥구', '기흥구']),
  entry('pyeongtaek', '경기도', '평택시', null, ['평택시', '평택']),
  entry('seoul-jung', '서울특별시', '중구', null, ['서울 중구', '중구']),
  entry('busan-jung', '부산광역시', '중구', null, ['부산 중구', '중구']),
];
export const alwaysAmbiguous = new Set(['중구', '북구', '남구', '동구', '서구']);
export function displayName(entry: Entry) { return [entry.level1, entry.level2, entry.level3].filter(Boolean).join(' '); }
