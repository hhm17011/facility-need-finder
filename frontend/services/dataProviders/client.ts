import type {RegionalDataResult} from './types';
export interface DataConfiguration {configured:boolean;message:string}
async function read<T>(path:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(`/api/regional-data/${path}`,{signal});const body=await response.json();
 if(!response.ok)throw new Error(typeof body.message==='string'?body.message:'인구 데이터를 불러오지 못했습니다.');return body as T;
}
export const getDataConfiguration=(signal?:AbortSignal)=>read<DataConfiguration>('config',signal);
export const getPopulationData=(signal?:AbortSignal)=>read<RegionalDataResult>('population',signal);
