import {SigunguMap,type SigunguMapProps} from './SigunguMap';
import { useEffect, useMemo, useState } from 'react';
import type { RegionEvidenceProfile } from '../../services/geography/types';
import type { BoundaryCollection, BoundarySelection } from '../../services/geography/boundaries/types';
import { joinSidoEvidence, parseSidoBoundaries, projectSidoBoundaries, sidoCode } from '../../services/geography/boundaries/koreaSido';
interface Props {
  sigungu?:SigunguMapProps;
  regions: RegionEvidenceProfile[]; selectedCode: string; onSelect: (code: string) => void;
  /** Future ADM2 layer may use this event; current screen stays at ADM1. */
  onBoundarySelect?: (selection:BoundarySelection) => void;
}
const dataUrl=new URL('../../../data/geography/korea_sido.geojson',import.meta.url).href;
function SidoMap({ regions, selectedCode, onSelect, onBoundarySelect }: Props) {
  const [data,setData]=useState<BoundaryCollection|null>(null);
  const [failed,setFailed]=useState(false);
  const [hovered,setHovered]=useState<string|null>(null);
  useEffect(()=>{const controller=new AbortController();fetch(dataUrl,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('Boundary load failed');return response.json();}).then(parseSidoBoundaries).then(setData).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[]);
  const projected=useMemo(()=>data?projectSidoBoundaries(data):null,[data]);
  const joined=useMemo(()=>projected?.features.map(entry=>({...entry,...joinSidoEvidence(entry.feature,regions)}))??[],[projected,regions]);
  const profile=regions.find(region=>region.region.id===selectedCode);
  const activeCode=selectedCode.startsWith('boundary:')?selectedCode.slice(9):profile?sidoCode(profile.region):null;
  const active=joined.find(region=>region.code===activeCode);
  const tooltip=joined.find(region=>region.code===hovered);
  function select(region:typeof joined[number]){
    const target=region.direct??(region.profiles.length===1?region.profiles[0]:null);
    onSelect(target?.region.id??`boundary:${region.code}`);
    onBoundarySelect?.({level:'sido',code:region.code,name:region.name,parentCode:null});
  }
  const summary=(region:typeof joined[number])=>!region.evidenceCount?'관련 근거 없음':`상태 ${region.regionalStatus} · 직접 근거 ${region.evidenceCount}건 · 근거 범위 ${region.coverage || '미평가'} · ${region.signal!==null?`Issue Signal ${region.signal.toFixed(1)}`:region.childSignal!==null?`하위 지역 최대 Issue Signal ${region.childSignal.toFixed(1)} · 시·도 점수 미산정`:'Issue Signal 미산정'}`;
  return <section className="panel map-panel administrative-map" aria-labelledby="map-title">
    <div className="panel-header"><div><span className="section-kicker">SPATIAL OVERVIEW</span><h3 id="map-title">대한민국 지도</h3></div><span className="small-tag">시·도 행정경계</span></div>
    <div className="map-canvas">
      {failed?<p className="boundary-error" role="alert">행정경계 데이터를 불러오지 못했습니다.</p>:!projected?<p className="boundary-loading" role="status">행정경계 데이터를 불러오는 중입니다.</p>:<svg viewBox="0 0 600 610" preserveAspectRatio="xMidYMid meet" aria-label="대한민국 17개 시·도 행정경계 지도. 지역을 선택해 연결 근거를 확인하세요.">
        {joined.map(region=><path key={region.code} data-region-code={region.code} data-regional-status={region.regionalStatus} d={region.path} role="button" tabIndex={0} aria-label={`${region.name}, ${summary(region)}`} aria-pressed={activeCode===region.code} className={`administrative-region ${activeCode===region.code?'selected':''}`} style={{fill:region.colorSignal===null?'#e3e9de':`hsl(${region.regionalStatus==='CONFLICTING'?8:region.regionalStatus==='PARTIALLY_SUPPORTED'?42:137} 25% ${82-region.colorSignal*0.46}%)`}} onMouseEnter={()=>setHovered(region.code)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(region.code)} onBlur={()=>setHovered(null)} onClick={()=>select(region)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(region);}if(event.key==='Escape')setHovered(null);}}><title>{region.name} · {summary(region)}</title></path>)}
        {joined.filter(region=>['KR-11','KR-41','KR-49'].includes(region.code)).map(region=><text key={region.code} x={region.centroid[0]} y={region.centroid[1]} className="boundary-label" textAnchor="middle">{region.name}</text>)}
      </svg>}
      {tooltip&&<div className="boundary-tooltip" role="tooltip"><strong>{tooltip.name}</strong><span>{summary(tooltip)}</span></div>}
    </div>
    {!failed&&projected&&regions.length===0&&<p className="boundary-empty">현재 확보된 근거에서 이 이슈와 연결된 지역이 없습니다.</p>}
    {active&&<div className="boundary-selection" aria-live="polite"><strong>{active.name}</strong><p>{summary(active)}</p>{active.children.length>0&&<><span>연결된 시·군·구 근거 · 경계 드릴다운 미제공</span><div>{active.children.map(child=><button type="button" key={child.region.id} aria-pressed={selectedCode===child.region.id} onClick={()=>onSelect(child.region.id!)}>{child.region.displayName} · {child.candidateScore===null?'점수 보류':child.candidateScore.toFixed(1)}</button>)}</div></>}</div>}
    <div className="map-footer"><span>중립: 직접 근거 없음 · 녹색: 확인 · 황색: 일부 확인 · 적색: 상충<br/>시·도 점수 없을 때 하위 지역 최댓값 표시</span><span>경계 기준 2021 · <a href="https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM1/" target="_blank" rel="noopener noreferrer">geoBoundaries / Natural Earth</a></span></div>
  </section>;
}

export function KoreaMap(props:Props){return props.sigungu?<SigunguMap {...props.sigungu}/>:<SidoMap {...props}/>;}
