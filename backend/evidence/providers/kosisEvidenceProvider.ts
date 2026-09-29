import {EvidenceType} from '../../../frontend/evidenceTypes';
import type {RawSearchResult,SearchProvider,SearchQuery} from '../../../frontend/services/evidence/types';
import {KosisClient} from '../../dataProviders/kosis/kosisClient';
import {KosisError} from '../../dataProviders/kosis/kosisTypes';
import {ProviderError} from './webSearchProvider';

const text=(row:Record<string,unknown>,key:string)=>typeof row[key]==='string'?(row[key] as string).trim():'';

/** Official KOSIS integrated search. Uses the existing server-side KOSIS credential. */
export function createKosisEvidenceProvider(apiKey:string,client=new KosisClient(apiKey)):SearchProvider {
 return {
  id:'kosis-search',mode:'live',categories:[EvidenceType.STATISTICS],configured:!!apiKey.trim(),
  async search(query:SearchQuery,_signal:AbortSignal):Promise<RawSearchResult[]> {
   if(!apiKey.trim())throw new ProviderError('AUTH');
   // buildQueries prefixes the interpreted facility when absent. A focused facility term
   // gives KOSIS better results than a general-web sentence with architectural qualifiers.
   const searchNm=query.query.split(/\s+/).find(Boolean)?.slice(0,80)??'';
   if(!searchNm)return [];
   try {
    const response=await client.request('statisticsSearch.do',{method:'getList',searchNm,sort:'RANK',startCount:'1',resultCount:String(query.maxResults)});
    return response.rows.slice(0,query.maxResults).flatMap((row):RawSearchResult[]=>{
     const title=text(row,'TBL_NM')||text(row,'STAT_NM');
     const rawUrl=text(row,'LINK_URL');
     if(!title||!rawUrl)return [];
     let url:string;try{const parsed=new URL(rawUrl);if(parsed.hostname==='kosis.kr'&&parsed.protocol==='http:')parsed.protocol='https:';url=parsed.href;}catch{return [];}
     const organization=text(row,'ORG_NM')||null;
     const detail=[text(row,'STAT_NM'),text(row,'FULL_PATH'),text(row,'ITEM')].filter(Boolean).join(' · ');
     return [{title,url,snippet:detail,sourceOrganization:organization,sourceLabel:'KOSIS 국가통계포털',publishedDate:null,providerDateHint:text(row,'END_PD')||null,retrievedAt:response.retrievedAt,provider:'kosis-search',mode:'live',retrievalStatus:'SEARCH_RESULT_ONLY',authors:[]}];
    });
   } catch(error) {
    if(error instanceof KosisError&&error.code==='EMPTY_RESPONSE')return [];
    if(error&&typeof error==='object'&&'code' in error&&error.code==='INVALID_KEY')throw new ProviderError('AUTH');
    throw new ProviderError('NETWORK');
   }
  },
 };
}
