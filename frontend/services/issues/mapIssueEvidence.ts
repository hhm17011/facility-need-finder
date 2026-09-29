import type { EvaluatedEvidenceItem } from '../evidence/analysis/types';
import { mapGeographicEvidence } from '../geography/geographicMapper';
import type { ArchitecturalIssue } from './types';
/** Called downstream of explicit issue selection. Never use unrelated search results. */
export function mapIssueEvidence(issue:ArchitecturalIssue, items:EvaluatedEvidenceItem[], mode:'demo'|'live') {
  const mapped=mapGeographicEvidence(items.filter(item=>issue.mode===mode&&issue.evidenceIds.includes(item.id)),mode);
  const allowed=new Set(issue.relatedRegions.map(region=>region.id));
  const candidates=mapped.candidates.filter(profile=>allowed.has(profile.region.id)).map((profile,index)=>({...profile,rank:index+1}));
  return {...mapped,candidates,profiles:mapped.profiles.filter(profile=>allowed.has(profile.region.id)).map(profile=>candidates.find(candidate=>candidate.region.id===profile.region.id)??{...profile,rank:null})};
}
