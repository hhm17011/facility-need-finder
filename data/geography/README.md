# 대한민국 시·도 행정경계 (ADM1)

## 원본과 라이선스

- 파일: `korea_sido.geojson` (17개 Polygon / MultiPolygon feature, 약 208 KB).
- 배포: [geoBoundaries gbOpen KOR ADM1](https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM1/).
- 원자료: Natural Earth. upstream metadata의 `boundarySource` 및 `boundaryLicense`를 `source-metadata.json`에 보존했다.
- 경계 기준연도: **2021**. upstream build date: 2023-12-12.
- 고정 다운로드: https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KOR/ADM1/geoBoundaries-KOR-ADM1.geojson
- 저장소 리비전: `9469f09`. upstream 원본을 수정하지 않고 저장했다.
- SHA-256: `6683cd1ad991676d96493fd0aae068215426497ccf82c8b0eb5683cad341cddc`.
- 이용 조건: **Public Domain**. [Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/). 자세한 고지는 `LICENSE-DATA.md`.
- 취득일: 2026-09-20.

이 데이터는 실제 지리 좌표 기반의 일반화된 공개 지도이며 최신 법정 행정경계·측량용 경계가 아니다. 2021 이후의 경계 변경을 적용했다고 주장하지 않는다. 데이터에 포함된 도서만 표시하며 일부 소규모 도서는 생략될 수 있다. 화면은 현행 이름(강원특별자치도·전북특별자치도 등)을 이름 대응표로 표시하지만 원래 geometry와 shapeName은 그대로 보존한다.

## 투영·검증

GeoJSON의 경도/위도 좌표를 `d3-geo`의 Lambert conformal conic (`geoConicConformal`)으로 투영한다. 중앙 경도 127.5°, 표준위도 33°/38°, 전체 경계를 같은 축척으로 fitExtent한다. 제주와 섬을 따로 옮기거나 확대하지 않는다. SVG는 비율을 유지해 컨테이너 중앙에 맞춘다.

D3의 구면 winding 규칙에 맞춰 필요한 링의 순서만 메모리에서 뒤집는다. 원래 좌표값과 저장 파일은 변경하지 않는다. 17개 고유 feature, KOR/ADM1, 닫힌 Polygon/MultiPolygon 링, 유한한 국내 범위 경위도를 검사하며 오류 시 수작업 지도 대체 없이 로딩 실패를 표시한다.

## 근거 연결과 선택

`shapeISO`는 이 데이터셋의 코드 네임스페이스다. 한국 국내 행정·통계 코드와 숫자가 비슷하다는 이유로 혼용하지 않는다. RegionReference에 정확히 같은 namespaced code가 있으면 연결하고, 없으면 정규화한 level1 공식 명칭으로 연결한다. 과거 강원도/전라북도 별칭을 지원한다.

시·군·구 근거는 명시된 소속 시·도에 연결한다. 툴팁 건수는 linked EvidenceItem.id의 고유 개수이며 전국 근거를 추가하지 않는다. 시·도 자체 Candidate Score가 있으면 Issue Signal로 표시한다. 하위 지역 점수만 있으면 색에는 그 최댓값을 사용하되 **하위 지역 최대 Issue Signal · 시·도 점수 미산정**으로 구분한다. 근거가 없거나 점수가 보류되면 중립색이다. 점수를 평균·합산하거나 새 지역 점수를 만들지 않는다.

시·도를 선택하면 자체 프로필이 있거나 하위 프로필이 하나일 때 기존 지역 상세와 연결한다. 여러 하위 지역이면 선택 목록을 제공한다. 근거 없는 시·도도 선택 가능하지만 가짜 RegionEvidenceProfile은 만들지 않는다. 지역 목록 선택은 해당 시·도 경계를 강조한다.

## 범위와 확장

현재 **시·도 지도만 구현**했다. 시·군·구 경계 드릴다운은 미구현이다. `BoundaryLayer`, `BoundarySelection`에 level/parentCode를 정의하고 `onBoundarySelect` 이벤트를 제공하여 향후 ADM2 데이터를 추가할 경계를 마련했다. 하위 지역 근거 선택 버튼은 시·군·구 경계 드릴다운이 아니다. 읍·면·동은 구현하지 않는다.

GeoJSON은 Vite 정적 자산 URL로 배포되며 앱 실행 중 외부 지도 서버에 의존하지 않는다. 화면의 데이터 출처 링크만 외부 문서를 연다.
