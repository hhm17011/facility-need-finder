import {EvidenceType} from '../../../frontend/evidenceTypes';
import type {RawSearchResult,SearchProvider} from '../../../frontend/services/evidence/types';
import {ProviderError} from './webSearchProvider';

function publicationDate(value:unknown):string|null {
 if(!value||typeof value!=='object'||!('date-parts' in value)||!Array.isArray(value['date-parts']))return null;
 const parts=value['date-parts'][0];if(!Array.isArray(parts)||!Number.isInteger(parts[0]))return null;
 const [year,month=1,day=1]=parts as number[];const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const parsed=new Date(`${date}T00:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
}

/** Crossref public REST API: real scholarly metadata, no API key or sign-up. */
export function createCrossrefProvider(fetcher:typeof fetch=fetch):SearchProvider {
 return {
  id:'crossref',mode:'live',categories:[EvidenceType.RESEARCH],configured:true,maxQueriesPerSearch:4,
  async search(query,signal):Promise<RawSearchResult[]> {
   const endpoint=new URL('https://api.crossref.org/works');
   endpoint.search=new URLSearchParams({'query.bibliographic':query.query,rows:String(query.maxResults),select:'DOI,title,published,URL,publisher,abstract,type,author,link'}).toString();
   let response:Response;try{response=await fetcher(endpoint,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),headers:{Accept:'application/json','User-Agent':'facility-need-finder/0.1'}});}catch{throw new ProviderError('NETWORK');}
   if(response.status===429)throw new ProviderError('RATE_LIMIT',60000);if(!response.ok)throw new ProviderError('NETWORK');
   let payload:unknown;try{payload=await response.json();}catch{throw new ProviderError('INVALID_RESPONSE');}
   if(!payload||typeof payload!=='object'||!('message' in payload)||!payload.message||typeof payload.message!=='object'||!('items' in payload.message)||!Array.isArray(payload.message.items))throw new ProviderError('INVALID_RESPONSE');
   const retrievedAt=new Date().toISOString();
   return payload.message.items.slice(0,query.maxResults).flatMap((item:unknown):RawSearchResult[]=>{
    if(!item||typeof item!=='object')return [];const row=item as Record<string,unknown>;
    const title=Array.isArray(row.title)&&typeof row.title[0]==='string'?row.title[0]:'';
    const links=Array.isArray(row.link)?row.link.flatMap(value=>value&&typeof value==='object'&&typeof (value as Record<string,unknown>).URL==='string'?[value as Record<string,unknown>]:[]):[];const fullText=links.find(value=>String(value['content-type']??'').includes('pdf')||String(value.URL).toLowerCase().includes('.pdf'))??links.find(value=>String(value['content-version']??'')==='vor');const url=typeof fullText?.URL==='string'?fullText.URL:typeof row.URL==='string'?row.URL:typeof row.DOI==='string'?`https://doi.org/${row.DOI}`:'';if(!title||!url)return [];
    const publisher=typeof row.publisher==='string'?row.publisher:null;const doi=typeof row.DOI==='string'?row.DOI:null;
    const abstract=typeof row.abstract==='string'?row.abstract:'';const fallback=[typeof row.type==='string'?row.type:null,publisher,doi?`DOI ${doi}`:null].filter(Boolean).join(' · ');
    const authors=Array.isArray(row.author)?row.author.flatMap(value=>value&&typeof value==='object'?[['given','family'].map(key=>typeof (value as Record<string,unknown>)[key]==='string'?(value as Record<string,string>)[key]:'').filter(Boolean).join(' ')]:[]).filter(Boolean):[];
    return [{title,url,snippet:abstract||fallback,sourceOrganization:publisher,sourceLabel:'Crossref',publishedDate:publicationDate(row.published),providerDateHint:null,retrievedAt,provider:'crossref',mode:'live',retrievalStatus:'SOURCE_METADATA_ONLY',authors,sourceType:'ACADEMIC',sourceAuthority:'ACADEMIC'}];
   });
  },
 };
}
