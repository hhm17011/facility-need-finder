import type { EvidenceItem, FacilityProfile } from '../../evidenceTypes';
import type { ArchitecturalIssue } from '../issues/types';
import type { RegionReference } from '../geography/types';
import type { CategorySearchResult } from '../evidence/types';
import { regionalQueries } from './requirements';
import { regionalConfig } from './config';
import { deduplicateEvidence } from '../evidence/evidenceNormalizer';
export interface RegionalSearchState {running:boolean;stage:'discovery'|'validation';items:EvidenceItem[];completed:number;total:number;messages:string[]}
export async function discoverRegionalEvidence(facility:FacilityProfile,issue:ArchitecturalIssue,mode:'demo'|'live',regions:RegionReference[],stage:'discovery'|'validation',signal:AbortSignal,onProgress:(state:RegionalSearchState)=>void){
 const targets=stage==='discovery'?[undefined]:regions.slice(0,regionalConfig.maxValidationRegions);
 const jobs=targets.flatMap(region=>[...new Set(regionalQueries(facility,issue.issueType,stage,region).map(q=>q.category))].map(category=>({region,category})));
 const state:RegionalSearchState={running:true,stage,items:[],completed:0,total:jobs.length,messages:[]};
 const emit=()=>onProgress({...state,items:[...state.items],messages:[...state.messages]});emit();
 for(const job of jobs){
  if(signal.aborted)break;
  try{
   const response=await fetch('/api/evidence/search',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),body:JSON.stringify({input:facility.originalInput,mode,category:job.category,regional:{issueType:issue.issueType,stage,regionId:job.region?.id}})});
   if(!response.ok)throw new Error('지역 검색 요청 실패');
   const result:CategorySearchResult=await response.json();
   state.items=deduplicateEvidence([...state.items,...result.items.filter(i=>i.mode===mode)]);
   if(result.message)state.messages.push(result.message);
  }catch{if(signal.aborted)break;state.messages.push('일부 지역 근거 검색에 연결하지 못했습니다.');}
  state.completed++;emit();
 }
 if(signal.aborted)state.messages.push('지역 근거 탐색을 중단했습니다. 이미 확보한 자료만 보존합니다.');
 state.running=false;emit();
}
