export type CategoryKey = 'demand' | 'supplyGap' | 'change' | 'context';
export interface AnalysisCategory { key: CategoryKey; label: string; description: string }
export interface FacilityInterpretation {
  name: string;
  facilityType: string;
  primaryUsers: string;
  analysisUnit: string;
}
export interface Evidence {
  category: CategoryKey;
  title: string;
  statement: string;
  value: string;
  comparison: string;
  source: string;
  referenceYear: string;
  isMock: boolean;
}
export interface RegionResult {
  rank: number;
  regionCode: string;
  regionName: string;
  needScore: number;
  categoryScores: Record<CategoryKey, number>;
  evidence: [Evidence, Evidence, Evidence];
  /** Schematic UI coordinates; never geographic coordinates. */
  mapPosition?: { x: number; y: number };
}
export interface AnalysisResult {
  datasetLabel: string;
  isMock: boolean;
  interpretation: FacilityInterpretation;
  categories: AnalysisCategory[];
  regions: RegionResult[];
}
export type AnalysisProvider = (input: string) => Promise<AnalysisResult>;
