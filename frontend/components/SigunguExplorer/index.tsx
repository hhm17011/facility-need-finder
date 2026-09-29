import {useEffect,useMemo,useRef,useState} from 'react';
import type {FacilityProfile} from '../../evidenceTypes';
import {targetPopulationProfile} from '../../services/demographics/targetPopulation';
import {demographicEngine} from '../../services/demographics/engine';
import type {DemographicMetric} from '../../services/demographics/types';
import {buildStructuredProfiles} from '../../services/demographics/profiles';
import {synthesizeStructuredIssues} from '../../services/issues/structuredIssues';
import type {FacilitySupplyResult} from '../../services/dataProviders/facilitySupply';
import {facilitySupplyRequirement} from '../../services/dataProviders/facilitySupply';
import {KoreaMap} from '../KoreaMap';
import {RegionDetail} from '../RegionDetail';
import {sigunguLayerLabels,sigunguLayerValue,type SigunguLayer} from '../../services/geography/boundaries/sigungu';
interface Configuration {configured:boolean;childcareConfigured:boolean;message:string}
export function SigunguExplorer({profile,mode}:{profile:FacilityProfile;mode:'demo'|'live'}){
 const [config,setConfig]=useState<Configuration|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [metrics,setMetrics]=useState<DemographicMetric[]>([]),[supplies,setSupplies]=useState<FacilitySupplyResult[]>([]),[warnings,setWarnings]=useState<string[]>([]);
 const [coverage,setCoverage]=useState<import('../../../backend/dataProviders/kosis/agePopulation').KosisCoverage[]>([]);
 const [search,setSearch]=useState(''),[selected,setSelected]=useState(''),[layer,setLayer]=useState<SigunguLayer>('TARGET_POPULATION'),[sort,setSort]=useState('name'),[page,setPage]=useState(0),[issueId,setIssueId]=useState('');
 const [years,setYears]=useState(5),[custom,setCustom]=useState(false),[min,setMin]=useState(0),[max,setMax]=useState('5');const controller=useRef<AbortController|null>(null);
 const target=useMemo(()=>targetPopulationProfile(profile,custom?[{label:'사용자 설정',minAge:min,maxAge:max==='open'?null:Number(max),definitionSource:'USER_CONFIGURED',configurable:true}]:undefined),[profile,custom,min,max]);
 const demographic=useMemo(()=>demographicEngine(metrics,target,mode),[metrics,target,mode]);
 const baseProfiles=useMemo(()=>buildStructuredProfiles(demographic,supplies,mode),[demographic,supplies,mode]);
 const issues=useMemo(()=>synthesizeStructuredIssues(baseProfiles),[baseProfiles]);const issue=issues.find(i=>i.id===issueId);
 const regions=useMemo(()=>buildStructuredProfiles(demographic,supplies,mode,issue),[demographic,supplies,mode,issue]);
 useEffect(()=>{const abort=new AbortController();fetch('/api/regional-data/config',{signal:abort.signal}).then(r=>r.json()).then(setConfig).catch(()=>{if(!abort.signal.aborted)setError('데이터 설정 확인 실패');});return()=>{abort.abort();controller.current?.abort();};},[]);
 const requirement=facilitySupplyRequirement(profile);
 async function run(kind:'population'|'supply'){
  if(mode!=='live'||controller.current)return;const abort=new AbortController();controller.current=abort;setBusy(true);setError('');
  const params=new URLSearchParams({facility:profile.originalInput});if(kind==='population'){params.set('years',String(years));if(custom){params.set('minAge',String(min));params.set('maxAge',max);}setMetrics([]);setCoverage([]);}else params.set('regionCode',selected);
  try{const response=await fetch(`/api/regional-data/${kind==='population'?'target-population':'facility-supply'}?${params}`,{signal:abort.signal});const data=await response.json();if(!response.ok)throw new Error(`${data.code??'REQUEST ERROR'}: ${data.message??'데이터 조회 실패'}`);if(!abort.signal.aborted){if(kind==='population'){setMetrics(data.metrics??[]);setWarnings(data.warnings??[]);setCoverage(data.coverage??[]);}else setSupplies(previous=>[...previous.filter(s=>!s.quality.queriedRegions.includes(selected)),data]);}}
  catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'데이터 조회 실패');}finally{if(!abort.signal.aborted)setBusy(false);if(controller.current===abort)controller.current=null;}
 }
 const visible=regions.filter(p=>p.region.displayName.includes(search)).sort((a,b)=>sort==='name'?a.region.displayName.localeCompare(b.region.displayName,'ko'):(sigunguLayerValue(b,sort as SigunguLayer)??-Infinity)-(sigunguLayerValue(a,sort as SigunguLayer)??-Infinity)||a.region.displayName.localeCompare(b.region.displayName,'ko'));
 const active=regions.find(p=>p.region.regionCode===selected);
 const c=demographic.coverage;
 return <section className="panel sigungu-explorer" aria-label="시군구 인구 및 시설 근거"><h3>시·군·구 지역 근거 · DATA MODE: {mode.toUpperCase()}</h3>
 <p>인구 근거로 탐색된 지역 · 최종 후보나 부지 선정이 아닙니다.</p>
 <p>KOSIS 대상인구: {metrics.some(m=>m.dataMode==='LIVE'&&m.verification==='source_verified')?'LIVE':'MISSING'} · 어린이집 공급: {supplies.some(s=>s.metrics.some(m=>m.dataMode==='LIVE'))?'LIVE':'MISSING'} · 이동/도시개발/공간 접근성: NOT CONNECTED</p>
 {config&&!config.configured&&<p>{config.message}</p>}{config&&!config.childcareConfigured&&<p>LIVE VALIDATION BLOCKED — API KEY REQUIRED: CHILDCARE_API_KEY</p>}{mode==='demo'&&<p>DEMO에서는 공식 수치를 조회하거나 분석하지 않습니다.</p>}
 <p>KOSIS 연결: {metrics.length?'LIVE':'수신 전'} · 시군구 총인구: {metrics.some(m=>m.metricType==='TOTAL_POPULATION'&&m.verification==='source_verified')?'LIVE':'MISSING'} · 연령/대상인구: {metrics.some(m=>m.metricType==='TARGET_POPULATION'&&m.verification==='source_verified')?'LIVE':'MISSING'}</p>
 {coverage.map(c=><p key={c.period}>KOSIS {c.period} · 원본 {c.rawRecordCount}행 / {c.rawRegionCount}지역 → 정규 시군구 {c.normalizedSigunguCount} → 미해결 {c.unresolvedRegionCount} / 모호 {c.ambiguousRegionCount} / 다른 행정단위 제외 {c.excludedNonSigunguCount}</p>)}
 <h4>대상인구 정의</h4><p>{target.primaryGroup} · {target.ageRanges.length?target.ageRanges.map(a=>`${a.label} (${a.minAge}~${a.maxAge??'이상'})`).join(' / '):target.primaryGroup==='GENERAL_POPULATION'?'전체 주민등록인구':'미설정'}</p><p>{target.rationale}</p>{target.ageRanges.filter(a=>a.definitionSource.startsWith('https://')).map(a=><a key={a.label} href={a.definitionSource} target="_blank" rel="noopener noreferrer">연령 정의 참고 </a>)}
 <div className="sigungu-controls"><label><input type="checkbox" checked={custom} disabled={busy} onChange={e=>{setCustom(e.target.checked);setMetrics([]);}}/>분석 연령 직접 설정</label>{custom&&<><label>최소 나이 <select value={min} disabled={busy} onChange={e=>{const n=Number(e.target.value);setMin(n);if(max!=='open'&&Number(max)<n)setMax(String(n));setMetrics([]);}}>{Array.from({length:100},(_,i)=><option key={i}>{i}</option>)}</select></label><label>최대 나이 <select value={max} disabled={busy} onChange={e=>{setMax(e.target.value);setMetrics([]);}}>{Array.from({length:100-min},(_,i)=><option key={i+min}>{i+min}</option>)}<option value="open">상한 없음</option></select></label></>}
 <label>비교 창 <select value={years} disabled={busy} onChange={e=>{setYears(Number(e.target.value));setMetrics([]);}}>{[1,3,5,10].map(n=><option key={n} value={n}>{n}년</option>)}</select></label><button className="secondary-button" disabled={busy||mode!=='live'||!config?.configured||target.primaryGroup==='UNCONFIGURED'} onClick={()=>run('population')}>시군구 대상인구 조회</button>
 <button className="secondary-button" disabled={busy||mode!=='live'||!selected||!config?.childcareConfigured||requirement.status!=='CONFIGURED'} onClick={()=>run('supply')}>선택 시군구 시설 공급 조회</button></div>
 {busy&&<p role="status">공식 자료를 조회하고 있습니다…</p>}{error&&<p role="alert">{error}</p>}<p>{warnings.join(' / ')}</p>
 <p>전체 분석 대상 {c.total} · 정상 {c.complete} · 일부 누락 {c.partial} · NO DATA {c.missing} · 비교 보류 {c.incomparable} · 매핑 실패 원본 행 {c.unresolvedRows}</p>
 <details><summary>미연결·상위 지역 원자료 {metrics.filter(m=>!m.regionCode).length}개</summary>{metrics.filter(m=>!m.regionCode).map(m=><details key={m.metricId}><summary>{m.regionName} · {m.administrativeLevel} · {m.dataMode}</summary><pre>{JSON.stringify(m.structuredSource?.rawSource,null,2)}</pre></details>)}</details>
 {supplies.map(s=><details key={s.quality.queriedRegions.join(',')}><summary>공급 데이터 품질 · 조회 지역 {s.quality.queriedRegions.join(',')}</summary><pre>{JSON.stringify(s.quality,null,2)}</pre><p>{s.warnings.join(' / ')}</p></details>)}
 <div className="sigungu-controls"><label>시군구 검색 <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label><label>정렬 <select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="name">지역 이름</option>{(['TARGET_POPULATION','TARGET_POPULATION_SHARE','TARGET_POPULATION_CHANGE','TARGET_POPULATION_CHANGE_RATE'] as const).map(k=><option key={k} value={k}>{sigunguLayerLabels[k]} · 큰 값부터</option>)}</select></label><label>지도 레이어 <select value={layer} onChange={e=>setLayer(e.target.value as SigunguLayer)}>{Object.entries(sigunguLayerLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
 <div className="regional-table-wrap"><table><thead><tr><th>지역</th><th>대상인구</th><th>변화율</th><th>상대위치</th><th>시설 수</th><th>정원</th><th>시설/1,000명</th><th>정원/1,000명</th><th>근거 상태</th></tr></thead><tbody>{visible.slice(page*30,(page+1)*30).map(p=><tr key={p.region.regionCode}><td><button className="secondary-button" onClick={()=>setSelected(p.region.regionCode!)}>{p.region.displayName}</button></td><td>{sigunguLayerValue(p,'TARGET_POPULATION')?.toLocaleString('ko-KR')??'N/A'}</td><td>{sigunguLayerValue(p,'TARGET_POPULATION_CHANGE_RATE')?.toFixed(2)??'N/A'}</td><td>{(p.demographicPositions?.find(v=>v.metric===layer)?.percentile??p.supplyRelativePositions?.find(v=>v.type===layer)?.percentile)?.toFixed(1)??'N/A'}</td><td>{sigunguLayerValue(p,'FACILITY_COUNT')??'N/A'}</td><td>{sigunguLayerValue(p,'TOTAL_CAPACITY')??'N/A'}</td><td>{sigunguLayerValue(p,'FACILITIES_PER_1000_TARGET_POPULATION')?.toFixed(2)??'N/A'}</td><td>{sigunguLayerValue(p,'CAPACITY_PER_1000_TARGET_POPULATION')?.toFixed(2)??'N/A'}</td><td>{p.facilityDataCoverage?.status}</td></tr>)}</tbody></table></div>
 <p>검색 결과 {visible.length}개 · {page+1}/{Math.max(1,Math.ceil(visible.length/30))} 페이지 · 상대위치는 현재 지도 지표의 비교 집단 백분위입니다.</p><button disabled={!page} onClick={()=>setPage(p=>p-1)}>이전</button><button disabled={(page+1)*30>=visible.length} onClick={()=>setPage(p=>p+1)}>다음</button>
 <KoreaMap regions={[]} selectedCode={selected} onSelect={setSelected} sigungu={{profiles:regions,layer,selectedCode:selected,onSelect:setSelected}}/>
 {issues.length>0&&<div><h4>검증된 변화 관계에서 나온 건축적 조사 질문</h4>{issues.map(i=><article key={i.id}><h4>{i.title}</h4><p>{i.summary}</p><p>{i.architecturalRelevance}</p><button onClick={()=>setIssueId(i.id)}>이슈 선택</button></article>)}</div>}
 {active&&<RegionDetail region={active}/>}<p>공급·인구만으로 최종 부지를 정하지 않습니다. 공간적 분포와 접근성, 실제 이용 수요의 추가 근거가 필요합니다.</p>
 </section>;
}
