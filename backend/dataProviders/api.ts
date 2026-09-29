import {ChildcareFacilityProvider} from './childcare/ChildcareFacilityProvider';
import {interpretFacility} from '../../frontend/services/interpretFacility';
import {targetPopulationProfile} from '../../frontend/services/demographics/targetPopulation';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {KosisProvider} from './kosis/KosisProvider';
import {KosisClient} from './kosis/kosisClient';
import {KosisError,noKeyMessage} from './kosis/kosisTypes';
import {PublicStandardFacilityProvider} from './publicStandard/PublicStandardFacilityProvider';
import {KosisChildcareSupplyProvider} from './kosis/KosisChildcareSupplyProvider';
const sameOrigin=(req:IncomingMessage)=>{if(!req.headers.origin)return true;try{const origin=new URL(req.headers.origin);return ['http:','https:'].includes(origin.protocol)&&origin.host===req.headers.host;}catch{return false;}};
export function createRegionalDataMiddleware(env:Record<string,string|undefined>,provider=new KosisProvider(new KosisClient(env.KOSIS_API_KEY??''))){
 const childcare=new ChildcareFacilityProvider(env.CHILDCARE_API_KEY??'');
 const childcareKosis=new KosisChildcareSupplyProvider(new KosisClient(env.KOSIS_API_KEY??''));
 const publicStandard=new PublicStandardFacilityProvider();
 let pending:ReturnType<KosisProvider['getPopulation']>|null=null;
 return async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  if(!req.url?.startsWith('/api/regional-data/')){next();return;}
  const send=(status:number,body:unknown)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  if(!req.headers.host||!sameOrigin(req)){send(403,{message:'동일 출처 요청만 허용됩니다.'});return;}
  if(req.method!=='GET'){send(405,{message:'GET 요청이 필요합니다.'});return;}
  if(req.url==='/api/regional-data/config'){send(200,{configured:provider.configured,provider:'KOSIS',agePopulation:provider.configured?'CONFIGURED':'MISSING',facilityData:childcare.configured?'CONFIGURED':'MISSING',childcareConfigured:childcare.configured,message:provider.configured?'공식 인구 데이터 조회 가능 · 아직 수신 전':noKeyMessage});return;}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/regional-data/target-population'||url.pathname==='/api/regional-data/facility-supply'||url.pathname==='/api/regional-data/facility-need-supply'){
   try{
    const input=url.searchParams.get('facility')??'';if(!input.trim()||input.length>300)throw new KosisError('INVALID_REQUEST','시설 입력을 확인해 주세요.');
    const facility=await interpretFacility(input);
    if(url.pathname.endsWith('target-population')){
     const years=Number(url.searchParams.get('years')??5);const min=url.searchParams.get('minAge'),max=url.searchParams.get('maxAge');
     const override=min!==null?[{label:'사용자 설정 연령',minAge:Number(min),maxAge:max==='open'?null:Number(max),definitionSource:'USER_CONFIGURED',configurable:true as const}]:undefined;
     const target=targetPopulationProfile(facility,override);send(200,{target,...await provider.getPopulationByAge({target,windowYears:years})});
    }else if(url.pathname.endsWith('facility-need-supply')){
     if(facility.facilityName==='어린이집'){const supply=await childcareKosis.getSupply();send(200,{facilityType:'어린이집',status:'SOURCE_VERIFIED',supply,metadata:childcareKosis.metadata(),coverage:{matchedRegions:supply.length,totalRegions:256,unknownRegions:256-supply.length},quality:childcareKosis.quality()});return;}
     if(!publicStandard.supports(facility.facilityName)){send(200,{facilityType:facility.facilityName,status:'NOT_CONNECTED',supply:[],metadata:null});return;}
     const supply=await publicStandard.getSupply(facility.facilityName);send(200,{facilityType:facility.facilityName,status:'PARTIAL',supply,metadata:publicStandard.metadata(facility.facilityName),coverage:{matchedRegions:supply.length,totalRegions:256,unknownRegions:256-supply.length},quality:publicStandard.quality(facility.facilityName)});
    }else{if(facility.facilityName!=='어린이집')throw new KosisError('NOT_CONFIGURED','이 시설 유형의 공급 제공자는 미연결입니다.');send(200,await childcare.getFacilitySupplyMetrics(url.searchParams.get('regionCode')??''));}
   }catch(error){const safe=error instanceof KosisError?error:new KosisError('REQUEST_FAILED','입력 또는 데이터 요청을 확인해 주세요.');send(safe.code==='MISSING_KEY'?503:502,{code:safe.code,message:safe.message});}return;
  }
  if(req.url!=='/api/regional-data/population'){send(404,{message:'지원하지 않는 요청입니다.'});return;}
  try{pending??=provider.getPopulation();send(200,await pending);}catch(error){const safe=error instanceof KosisError?error:new KosisError('REQUEST_FAILED','인구 데이터를 처리하지 못했습니다.');send(safe.code==='MISSING_KEY'?503:502,{code:safe.code,message:safe.message});}finally{pending=null;}
 };
}
