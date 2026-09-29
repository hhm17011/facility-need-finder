import {agePopulationTable} from './agePopulation';
import type {KosisTableDefinition} from './kosisTypes';
/** Documented table, not a claim of successful LIVE validation. Codes/periods resolved at runtime. */
export const populationTable:KosisTableDefinition={id:'total-population',orgId:'101',tableId:'DT_1B040A3',name:'행정구역(시군구)별, 성별 인구수',metricFamily:'TOTAL_POPULATION',administrativeLevel:'MIXED',supportedPeriods:['M','Y'],source:'https://kosis.kr/openapi/',totalItemNames:['총인구수']};
export class KosisTableRegistry {
 private tables=new Map<string,KosisTableDefinition>();
 constructor(tables:KosisTableDefinition[]=[populationTable,agePopulationTable]){tables.forEach(table=>this.register(table));}
 register(table:KosisTableDefinition){
  if(!table.id||!table.orgId||!table.tableId||!table.totalItemNames.length||!table.source.startsWith('https://kosis.kr/'))throw new Error('Invalid reviewed KOSIS table definition');
  if(this.tables.has(table.id))throw new Error('Duplicate KOSIS table');
  this.tables.set(table.id,structuredClone(table));
 }
 get(id='total-population'){const table=this.tables.get(id);if(!table)throw new Error('Unregistered KOSIS table');return structuredClone(table);}
 list(){return [...this.tables.values()].map(table=>structuredClone(table));}
}
