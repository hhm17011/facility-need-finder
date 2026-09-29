"""One-time data preparation; requires shapely. No demographic values are generated.
Usage: python scripts/build-sigungu-assets.py /path/to/pinned/dong.geojson
"""
import csv,io,json,zipfile,hashlib,sys
from pathlib import Path
from datetime import datetime,timezone
from collections import defaultdict
from shapely.geometry import shape,mapping
from shapely.ops import unary_union
root=Path(__file__).resolve().parents[1]/'data/geography/sigungu'
z=zipfile.ZipFile(root/'legal-codes.zip')
raw=z.read(z.namelist()[0]).decode('cp949')
rows=list(csv.DictReader(io.StringIO(raw),delimiter='\t'))
selected=[r for r in rows if r['법정동코드'].endswith('00000')]
active={r['법정동명']:r['법정동코드'][:5] for r in selected if r['폐지여부']=='존재'}
registry=[]
for r in selected:
 code,name,status=r['법정동코드'],r['법정동명'],r['폐지여부'];parts=name.split()
 level='SIDO' if code.endswith('00000000') else 'SIGUNGU'
 # Sejong's legal code is a SIGUNGU code; source name has no city/district suffix.
 if level=='SIDO':continue
 parent=parts[0];children=any(n.startswith(name+' ') and len(n.split())>len(parts) for n in active)
 registry.append(dict(regionCode=code[:5],legalCode=code,name=parts[-1],fullName=name,level=level,parentSidoCode=active.get(parent,code[:2]+'000')[:2],parentSidoName=parent,parentCityCode=active.get(' '.join(parts[:2])) if len(parts)>2 else None,status='ACTIVE' if status=='존재' else 'RETIRED',analysisUnit=status=='존재' and not children))
(root/'registry.json').write_text(json.dumps(registry,ensure_ascii=False,separators=(',',':')))
source=Path(sys.argv[1]);data=json.loads(source.read_text());groups=defaultdict(list);props={}
for f in data['features']:
 p=f['properties'];code=p['sgg'];groups[code].append(shape(f['geometry']));props[code]=p
features=[]
for code,geometries in groups.items():
 p=props[code];matches=[r for r in registry if r['regionCode']==code and r['status']=='ACTIVE'];geometry=unary_union(geometries).simplify(.0007,preserve_topology=True)
 if geometry.geom_type=='Polygon':geometry={'type':'MultiPolygon','coordinates':[mapping(geometry)['coordinates']]}
 else:geometry=mapping(geometry)
 name=matches[0]['fullName'] if len(matches)==1 else p['sidonm']+' '+p['sggnm']
 features.append({'type':'Feature','properties':{'regionCode':code,'fullName':name,'boundaryDate':'2026-07-01','codeNamespace':'MOIS_LEGAL_SIGUNGU'},'geometry':geometry})
out=root/'korea_sigungu.geojson';out.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
metadata={'registrySource':'https://www.code.go.kr/etc/codeFullDown.do?codeseId=법정동코드','retrievedAt':datetime.now(timezone.utc).isoformat(),'codeNamespace':'MOIS_LEGAL_SIGUNGU','registrySha256':hashlib.sha256((root/'legal-codes.zip').read_bytes()).hexdigest(),'boundarySource':'https://github.com/vuski/admdongkor','boundaryCommit':'dd1881663fcabc69b81393604e91ebf3a4202e9a','boundaryDate':'2026-07-01','boundarySourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'boundaryOutputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'processing':'Dissolve source sgg groups; topology-preserving simplify 0.0007 degrees for display. No population interpolation.','boundaryCount':len(features),'activeSigungu':sum(r['status']=='ACTIVE' for r in registry),'analysisUnits':sum(r['analysisUnit'] for r in registry)}
(root/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2));print(metadata)
