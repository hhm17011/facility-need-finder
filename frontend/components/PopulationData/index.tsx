import {useEffect,useMemo,useRef,useState} from 'react';
import type {FacilityProfile} from '../../evidenceTypes';
import type {RegionalMetric} from '../../services/regional/types';
import type {RegionalDataResult} from '../../services/dataProviders/types';
import {getDataConfiguration,getPopulationData,type DataConfiguration} from '../../services/dataProviders/client';
import {populationRequirement,populationTimeSeries,populationPhenomena} from '../../services/dataProviders/population';
export function PopulationData({mode,profile,onMetrics}:{mode:'demo'|'live';profile:FacilityProfile;onMetrics:(metrics:RegionalMetric[])=>void}){
 const [config,setConfig]=useState<DataConfiguration|null>(null);const [data,setData]=useState<RegionalDataResult|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [filter,setFilter]=useState('');const controller=useRef<AbortController|null>(null);
 useEffect(()=>{const abort=new AbortController();getDataConfiguration(abort.signal).then(setConfig).catch(()=>{if(!abort.signal.aborted)setError('데이터 설정을 확인하지 못했습니다.');});return()=>{abort.abort();controller.current?.abort();};},[]);
 const requirement=populationRequirement(profile);
 const series=useMemo(()=>populationTimeSeries(data?.metrics??[]),[data]);
 const phenomena=useMemo(()=>populationPhenomena(data?.metrics??[],profile),[data,profile]);
 async function load(){
  if(controller.current||mode!=='live')return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setData(null);onMetrics([]);
  try{const result=await getPopulationData(abort.signal);if(!abort.signal.aborted){setData(result);onMetrics(result.metrics);}}
  catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'인구 데이터를 불러오지 못했습니다.');}
  finally{if(!abort.signal.aborted)setBusy(false);if(controller.current===abort)controller.current=null;}
 }
 const live=data?.metrics.some(m=>m.value!==null&&m.verification==='source_verified');
 const shown=(data?.metrics??[]).filter(m=>m.regionName.includes(filter.trim()));
 return <section className="panel population-data" aria-label="공식 인구 데이터"><h3>DATA SOURCES · KOSIS</h3><p className={`mode-badge ${mode}`}>DATA MODE: {mode.toUpperCase()}</p>
  <p>KOSIS: {live?'LIVE':config?.configured?'설정됨 · 실제 데이터 수신 대기':'MISSING'} · 총인구: {live?'LIVE':'MISSING'} · 연령 인구·시설 공급: 위 시군구 패널에서 별도 확인</p>
  {config&&!config.configured&&<p>{config.message}</p>}{mode==='demo'&&<p>DEMO 환경에서는 공식 통계를 분석에 혼합하지 않습니다. LIVE SEARCH를 선택하면 검색 API와 별개로 인구 데이터를 조회할 수 있습니다.</p>}
  <p>{requirement.targetPopulationType} · {requirement.reason}</p>
  <button className="secondary-button" disabled={mode!=='live'||!config?.configured||busy} onClick={load}>{busy?'공식 인구 데이터 조회 중…':'KOSIS 실제 인구 데이터 조회'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<><p>{live?'인구 관련 실제 데이터가 연결되었습니다. 시설 공급 및 공간 데이터는 아직 추가 연결이 필요합니다.':'응답은 받았지만 검증된 인구 값이 없습니다.'}</p><p>시설 공급 데이터 필요 · 인구만으로 건축 이슈·관계·지역 순위를 생성하지 않습니다.</p><p>{data.warnings.join(' / ')}</p>
   <label>지역 검색 <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="지역 이름"/></label>
   <p>응답 지표 {data.metrics.length}개 · 지역 연결 {data.metrics.filter(m=>m.regionId).length}개 · 표시 {Math.min(shown.length,50)}/{shown.length}개. 표시 상한은 분석 자료 수를 제한하지 않습니다.</p>
   <div className="regional-table-wrap"><table><thead><tr><th>지역 · 행정 단위</th><th>총인구</th><th>기준</th><th>출처 · 확인</th></tr></thead><tbody>{shown.slice(0,50).map(m=><tr key={m.metricId}><td>{m.regionName||'지역 미제공'}<br/>{m.administrativeLevel} · {m.structuredSource?.normalizationStatus}</td><td>{m.value===null?'MISSING':m.value.toLocaleString('ko-KR')} {m.unit}<br/>{m.verification==='source_verified'?'LIVE':'검증 보류'}</td><td>{m.referenceDate??'미확인'}</td><td><details><summary>KOSIS 국가통계포털 · 통계표 보기</summary><p>{m.structuredSource?.tableName} ({m.structuredSource?.tableId}) · 기관 {m.structuredSource?.organizationId}</p><p>{m.sourceLocator}</p><p>수신: {m.structuredSource?.retrievedAt}</p><p>{m.limitations.join(' / ')}</p><a href={m.sourceUrl!} target="_blank" rel="noopener noreferrer">KOSIS 공식 서비스 ↗</a><pre>{JSON.stringify(m.structuredSource?.rawSource,null,2)}</pre></details></td></tr>)}</tbody></table></div>
   <details><summary>시계열 {series.length}개 · 증감 확인 {series.filter(s=>s.change).length}개</summary>{series.filter(s=>!filter||data.metrics.some(m=>m.regionId===s.regionId&&m.regionName.includes(filter))).slice(0,50).map((s,index)=><p key={index}>{data.metrics.find(m=>m.regionId===s.regionId)?.regionName} · {s.points.map(p=>`${p.date}: ${p.value}명`).join(' → ')}<br/>{s.change?`${s.change.absolute}명 / ${s.change.percentage.toFixed(2)}% (${s.change.formula})`:'증감 계산 보류 · 경계·정의·시점의 비교 가능성 확인 필요'}</p>)}</details>
   {phenomena.map(p=><p key={p.id}>{p.title} · {p.description}</p>)}
   <details><summary>원본 통계표 메타데이터</summary><pre>{JSON.stringify(data.metadata,null,2)}</pre></details>
  </>}
 </section>;
}
