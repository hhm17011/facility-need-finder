import type { AnalysisCategory, AnalysisProvider, AnalysisResult, RegionResult } from '../types';

// MOCK DATA ONLY: fictional regions, illustrative scores, no statistical calculations.
const categories: AnalysisCategory[] = [
  { key: 'demand', label: '수요', description: '시설을 필요로 하는 이용자 규모' },
  { key: 'supplyGap', label: '공급 부족', description: '이용 수요 대비 시설의 부족 정도' },
  { key: 'change', label: '인구 변화', description: '잠재 이용자 규모의 변화' },
  { key: 'context', label: '지역 여건', description: '생활권과 주변 환경의 적합성' },
];
const scores = [92.3, 90.8, 88.7, 87.4, 86.9, 85.6, 84.2, 83.8, 82.1, 81.5,
  80.9, 80.2, 79.6, 79.1, 78.7, 78.2, 77.6, 77.1, 76.8, 76.2,
  75.9, 75.4, 74.8, 74.3, 73.9, 73.5, 72.8, 72.3, 71.7, 71.2,
  70.8, 70.2, 69.7, 69.1, 68.6, 68.2, 67.8, 67.1, 66.6, 66.2,
  65.7, 65.1, 64.6, 64.2, 63.7, 63.1, 62.6, 62.2, 61.7, 61.1];
const profiles = [
  { demand: 94, supplyGap: 96, change: 88, context: 91 },
  { demand: 91, supplyGap: 93, change: 86, context: 89 },
  { demand: 87, supplyGap: 91, change: 84, context: 88 },
  { demand: 83, supplyGap: 88, change: 81, context: 86 },
  { demand: 80, supplyGap: 85, change: 78, context: 82 },
];
const sampleValues = [
  ['영유아 100명당 3.2곳', '가상 비교 평균 5.1곳', '영유아 8,420명', '가상 비교 평균 대비 +24%', '최근 3년 +8.4%', '가상 비교 평균 +2.1%'],
  ['영유아 100명당 3.6곳', '가상 비교 평균 5.1곳', '영유아 7,610명', '가상 비교 평균 대비 +19%', '최근 3년 +7.2%', '가상 비교 평균 +2.1%'],
  ['영유아 100명당 3.9곳', '가상 비교 평균 5.1곳', '영유아 6,980명', '가상 비교 평균 대비 +16%', '최근 3년 +6.5%', '가상 비교 평균 +2.1%'],
];
const regions: RegionResult[] = scores.map((needScore, index) => {
  const values = sampleValues[index % sampleValues.length];
  const source = { source: 'MOCK DATA', referenceYear: 'MOCK', isMock: true };
  return {
    rank: index + 1,
    regionCode: `MOCK-${String(index + 1).padStart(3, '0')}`,
    regionName: `가상 ${String.fromCharCode(65 + Math.floor(index / 5))}시 ${['가', '나', '다', '라', '마'][index % 5]}구`,
    needScore,
    categoryScores: profiles[Math.floor(index / 10)],
    mapPosition: { x: 215 + (index % 5) * 21 + Math.sin(Math.floor(index / 5)) * 25, y: 108 + Math.floor(index / 5) * 28 },
    evidence: [
      { ...source, category: 'supplyGap', title: '수요에 비해 부족한 보육 공간', statement: '영유아 인구 대비 어린이집 공급 수준이 가상 전국 평균보다 낮은 상황을 예시합니다.', value: values[0], comparison: values[1] },
      { ...source, category: 'demand', title: '집중된 영유아 돌봄 수요', statement: '영유아 및 양육가구가 많아 생활권 안의 보육시설 수요가 높은 상황을 예시합니다.', value: values[2], comparison: values[3] },
      { ...source, category: 'change', title: '증가하는 잠재 이용자', statement: '영유아 인구의 증가로 향후 추가 보육 공간이 필요할 수 있는 상황을 예시합니다.', value: values[4], comparison: values[5] },
    ],
  };
});
export const mockAnalysis: AnalysisResult = {
  datasetLabel: 'MOCK DATA', isMock: true,
  interpretation: { name: '어린이집', facilityType: '보육시설', primaryUsers: '0~5세 영유아 및 양육가구', analysisUnit: '전국 시·군·구' },
  categories, regions,
};
/** Replace this provider with real structured analysis in a later stage.
 * Every input intentionally opens the same explicitly labelled daycare fixture.
 */
export const analyzeFacility: AnalysisProvider = async (input) => {
  if (!input.trim()) throw new Error('계획하고 있는 시설을 입력해 주세요.');
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  return mockAnalysis;
};
