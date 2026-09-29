import {EvidenceType} from '../../../frontend/evidenceTypes';
import {plainText} from '../../../frontend/services/evidence/evidenceNormalizer';
import type {RawSearchResult,SearchProvider} from '../../../frontend/services/evidence/types';
import {ProviderError} from './webSearchProvider';

const attr=(html:string,name:string)=>html.match(new RegExp(`${name}=["']([^"']+)["']`,'i'))?.[1]??'';
const capture=(html:string,label:string)=>plainText(html.match(new RegExp(`<strong[^>]*>\\s*${label}\\s*</strong>[\\s\\S]*?<span[^>]*>([\\s\\S]*?)</span>`,'i'))?.[1]??'');
export function parsePublicDataResults(html:string,retrievedAt=new Date().toISOString()):RawSearchResult[]{
 const blocks=html.split(/<div\s+class=["'][^"']*apply-result-item[^"']*["'][^>]*>/i).slice(1);
 return blocks.flatMap(block=>{const head=block.match(/<a\b[^>]*href=["']\/data\/[^"']+["'][^>]*>[\s\S]*?<\/a>/i)?.[0];if(!head)return[];const href=attr(head,'href');const title=plainText(head);if(!href||!title)return[];let url:string;try{url=new URL(href,'https://www.data.go.kr').href;}catch{return[];}
  const summary=plainText(block.match(/<span\s+class=["'][^"']*apply-result-summary[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]??'');const organization=capture(block,'제공기관')||null;const modified=capture(block,'수정일');
  return [{title,url,snippet:summary,sourceOrganization:organization,sourceLabel:'공공데이터포털',publishedDate:null,providerDateHint:modified||null,retrievedAt,provider:'data-go-kr-catalog',mode:'live',retrievalStatus:'SOURCE_METADATA_ONLY',authors:[],sourceType:'PUBLIC_DATA',sourceAuthority:'PUBLIC_INSTITUTION'}];});
}
/** Official public-data catalog discovery. Catalog metadata is never a verified claim. */
export function createPublicDataPortalProvider(fetcher:typeof fetch=fetch):SearchProvider{return{id:'data-go-kr-catalog',mode:'live',categories:[EvidenceType.RESEARCH],configured:true,maxQueriesPerSearch:3,async search(query,signal){const endpoint=new URL('https://www.data.go.kr/tcs/dss/selectDataSetList.do');endpoint.search=new URLSearchParams({dType:'TOTAL',keyword:query.query}).toString();let response:Response;try{response=await fetcher(endpoint,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),headers:{Accept:'text/html','User-Agent':'facility-need-finder/0.1 (university prototype)'}});}catch{throw new ProviderError('NETWORK');}if(!response.ok)throw new ProviderError('NETWORK');return parsePublicDataResults(await response.text()).slice(0,query.maxResults);}};}
