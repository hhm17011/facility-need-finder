export const problemDefinitionConfig = {
  weights: { evidenceStrength: 1, independentSources: 1, directness: 1, regionalSpecificity: 1 },
  sourceTarget: 3, minimumStrength: 60, minimumRelevance: 60, minimumCompleteness: 0.6,
  recentMonths: 36, maximumClaimsPerSection: 2,
} as const;
