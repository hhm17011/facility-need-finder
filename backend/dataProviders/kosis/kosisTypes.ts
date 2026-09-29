export type KosisRow=Record<string,unknown>;
export interface KosisTableDefinition {
 id:string;orgId:string;tableId:string;name:string;metricFamily:string;
 administrativeLevel:'MIXED';supportedPeriods:('M'|'Y')[];source:string;
 totalItemNames:string[];
}
export interface KosisMetadata {
 table:KosisRow[]; organization:KosisRow[]; periods:KosisRow[]; classifications:KosisRow[]; units:KosisRow[];
}
export const textField=(row:KosisRow,key:string)=>typeof row[key]==='string'?(row[key] as string).trim():'';
export const noKeyMessage='KOSIS API 키가 설정되지 않아 실제 인구 데이터를 불러올 수 없습니다.';
export class KosisError extends Error {
 constructor(public readonly code:string,message:string,public readonly upstreamCode?:string){super(message);this.name='KosisError';}
}
