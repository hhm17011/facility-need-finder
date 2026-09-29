export const issueConfig = {
  minimumRelevance: 60, minimumCompleteness: 0.6,
  high: { sources: 4, categories: 3, strength: 80, phenomenon: 80, relationship: 80 },
  medium: { sources: 2, categories: 2, strength: 65, phenomenon: 65, relationship: 65 },
} as const;
