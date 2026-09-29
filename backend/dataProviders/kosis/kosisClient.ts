import {KosisError,noKeyMessage,type KosisRow} from './kosisTypes';
const paths=['statisticsData.do','statisticsSearch.do','Param/statisticsParameterData.do'];
export class KosisClient {
 readonly configured:boolean;
 private cache=new Map<string,{expires:number;rows:KosisRow[];retrievedAt:string}>();
 private pending=new Map<string,Promise<{rows:KosisRow[];retrievedAt:string}>>();
 private queue:Promise<unknown>=Promise.resolve(); private nextAt=0;
 constructor(private key:string,private fetcher:typeof fetch=fetch,private ttlMs=300_000,private intervalMs=1100,private timeoutMs=15000){this.configured=!!key.trim();}
 async request(path:string,params:Record<string,string>){
  if(!this.configured)throw new KosisError('MISSING_KEY',noKeyMessage);
  if(!paths.includes(path)||'apiKey' in params)throw new KosisError('INVALID_REQUEST','지원하지 않는 KOSIS 요청입니다.');
  const cacheKey=JSON.stringify([path,Object.entries(params).sort(([a],[b])=>a.localeCompare(b))]);
  const cached=this.cache.get(cacheKey);if(cached&&cached.expires>Date.now())return structuredClone(cached);
  const inFlight=this.pending.get(cacheKey);if(inFlight)return structuredClone(await inFlight);
  const work=this.queue.catch(()=>{}).then(async()=>{
   const wait=this.nextAt-Date.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
   this.nextAt=Date.now()+this.intervalMs;
   const url=new URL(path,'https://kosis.kr/openapi/');
   for(const [k,v] of Object.entries({...params,format:'json',jsonVD:'Y',apiKey:this.key}))url.searchParams.set(k,v);
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   try{
    const response=await this.fetcher(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok)throw new KosisError(response.status===401||response.status===403?'INVALID_KEY':'API_ERROR','KOSIS 요청이 거절되었습니다. 키·이용 한도를 확인해 주세요.');
    const raw=await response.text();if(raw.length>12_000_000)throw new KosisError('INVALID_RESPONSE','KOSIS 응답 크기가 허용 범위를 초과했습니다.');
    let data:unknown;try{data=JSON.parse(raw);}catch{throw new KosisError('INVALID_RESPONSE','KOSIS JSON 응답을 확인하지 못했습니다.');}
    const error=Array.isArray(data)?data.find(row=>row&&typeof row==='object'&&('err' in row||'errCd' in row)):data;
    if(error&&typeof error==='object'&&('err' in error||'errCd' in error)){const code=String('err' in error?error.err:error.errCd);throw new KosisError(code==='30'?'EMPTY_RESPONSE':'API_ERROR','KOSIS API 오류입니다. 키·요청 조건·이용 한도를 확인해 주세요.',/^\d{1,3}$/.test(code)?code:undefined);}
    if(!Array.isArray(data)||data.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new KosisError('INVALID_RESPONSE','KOSIS 응답 형식이 예상과 다릅니다.');
    if(!data.length)throw new KosisError('EMPTY_RESPONSE','KOSIS에 해당 조건의 자료가 없습니다.');
    // Do not retain a server credential even if an upstream response accidentally echoes it.
    const rows=JSON.parse(JSON.stringify(data).split(this.key).join('[REDACTED]')) as KosisRow[];
    const result={rows,retrievedAt:new Date().toISOString()};
    if(this.cache.size>=64)this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(cacheKey,{...result,expires:Date.now()+this.ttlMs});return result;
   }catch(error){if(error instanceof KosisError)throw error;throw new KosisError(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR',controller.signal.aborted?'KOSIS 응답 시간이 초과되었습니다.':'KOSIS에 연결하지 못했습니다.');}
   finally{clearTimeout(timer);}
  });
  this.queue=work;this.pending.set(cacheKey,work);
  try{return structuredClone(await work);}finally{this.pending.delete(cacheKey);}
 }
}
