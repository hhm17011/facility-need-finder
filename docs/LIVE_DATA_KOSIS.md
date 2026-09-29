# LIVE DATA #1 — KOSIS

## 현재 상태

총인구 데이터 경로를 구현했습니다. 개발 환경에 `KOSIS_API_KEY`가 없어 실제 API 요청은 검증하지 못했습니다. 테스트의 TEST ONLY 수치는 응답 계약 검증용이며 앱 데이터로 사용하지 않습니다. 새로운 DEMO 지역 통계는 추가하지 않았습니다.

인구만으로 건축 이슈, 시설 부족, 시설 공급과의 관계 또는 지역 순위를 만들지 않습니다. 시설 공급 데이터와 공간 자료가 다음으로 필요합니다. LIVE DATA #2는 구현하지 않았습니다.

## 설정과 실행

프로젝트 `.env.local`에 `KOSIS_API_KEY=발급받은키`를 설정한 후 개발 서버를 재시작합니다. `VITE_` 접두사를 사용하지 않습니다. 키를 소스나 문서에 기록하지 않습니다. Vite 서버/preview 미들웨어가 키를 읽으며 브라우저에는 설정 여부만 전달합니다. 정적 dist만 배포하면 API가 작동하지 않습니다. 배포는 이번 범위 밖입니다.

시설 입력 후 기존 `LIVE SEARCH` 모드를 선택하고 `KOSIS 실제 인구 데이터 조회`를 실행합니다. Brave 검색 키와 독립적으로 사용할 수 있으며 이슈 생성 전에 조회할 수 있습니다. 키가 없으면 `KOSIS API 키가 설정되지 않아 실제 인구 데이터를 불러올 수 없습니다.`를 표시하고 조회를 비활성화합니다.

## 아키텍처

- `backend/dataProviders/kosis/KosisProvider.ts`: 공통 `RegionalDataProvider` 구현. 총인구/여러 시점/메타데이터/테이블 검색.
- `kosisClient.ts`: HTTPS JSON 요청, 메모리 캐시, 중복 요청 합치기, 순차 요청, 타임아웃, 안전한 오류.
- `kosisTables.ts`: 검토 후 명시적으로 등록하는 통계표 registry.
- `kosisNormalizer.ts`: 실제 응답 계약 검증 → 기존 `RegionalMetric[]` 및 `RegionReference`.
- `frontend/services/dataProviders/types.ts`: 제공자 독립 인터페이스와 원본 출처 계약.
- `frontend/services/dataProviders/population.ts`: 설정 가능한 시설별 인구 요구사항, 호환 시계열/증감/현상.
- `frontend/services/regional/structuredData.ts`: 기존 지역 엔진에 구조화 관찰값 부착. KOSIS 요청이나 코드에 의존하지 않음.
- `frontend/components/PopulationData`: LIVE/MISSING 상태, 지역 검색, 값·단위·시점·원본·표 메타데이터 표시. 기존 UI 재설계 없음.

## 등록한 통계표와 공식 명세

등록 ID `total-population`, 기관 `101`, 표 `DT_1B040A3`, 행정구역(시군구)별, 성별 인구수, 지표 `TOTAL_POPULATION`.

- [공식 통계자료 JSON 명세](https://kosis.kr/openapi/devGuide/devGuide_0201List.do)
- [통계표 명칭](https://kosis.kr/openapi/devGuide/devGuide_060101List.do)
- [수록정보](https://kosis.kr/openapi/devGuide/devGuide_060103List.do)
- [분류/항목 및 상위 분류값](https://kosis.kr/openapi/devGuide/devGuide_060104List.do)
- [단위](https://kosis.kr/openapi/devGuide/devGuide_060106List.do)
- [통계표 검색](https://kosis.kr/openapi/devGuide/devGuide_0701List.do)

HTML 통계 스크래핑은 하지 않습니다. 위 문서는 구현 명세 확인에만 사용했습니다. 자료는 `https://kosis.kr/openapi/Param/statisticsParameterData.do`의 공식 JSON 응답만 사용합니다.

`getMeta` TBL/ORG/PRD/ITM/UNIT를 보존합니다. PRD `detail=Y`로 확인된 시점만 허용합니다. 총인구의 항목 코드는 ITM의 `OBJ_ID=ITEM`, `ITM_NM=총인구수`로 정확히 한 개 확인된 값을 사용합니다. 코드를 하드코딩하거나 추정하지 않습니다. 메타데이터 형식이 다르면 안전하게 실패합니다. 실제 응답으로 세부 계약 확인이 추가로 필요합니다.

기본 요청은 메타데이터에 월이 있으면 월, 아니면 연 단위 최근 2개 시점입니다. 호출자는 확인된 연속 시점 최대 6개를 선택할 수 있습니다. 한 번의 `objL1=ALL` 표 조회로 여러 지역을 가져오며 지역마다 요청하지 않습니다. 월/연의 단위는 유지하고 월 값을 연간 증감으로 표시하지 않습니다. 지역별 누락 시점은 보간하지 않습니다.

`discoverTables(search)`는 공식 검색 API의 최대 10개 결과를 보존합니다. 검색 결과를 자동 등록하지 않습니다. 추가 테이블은 metadata·총인구/연령 정의·분류·단위 및 정규화 어댑터를 검토한 뒤 registry에 추가합니다. 검증된 연령표가 없어 `AGE_POPULATION=NOT_CONFIGURED`입니다. 이동·가구·시설 API는 아직 없습니다.

## 정규화와 행정 해상도

`C1`은 제공자 전용 코드(`structuredSource.providerRegionCode`)입니다. 국내 정규 행정 코드로 복사하지 않습니다. 기존 `RegionReference.regionCode`는 검증 매핑이 없으면 null입니다. 내부 id도 공식 코드가 아닙니다.

`C1_NM`과 ITM 메타데이터의 `UP_ITM_ID`로 연결되는 명시적 상위 계층만 사용합니다. 코드 접두사·응답 순서·퍼지 매칭으로 부모를 추정하지 않습니다. 상위 지역이 있는 중구는 정확한 전체 이름으로 기존 사전을 조회하며 부모가 없으면 `AMBIGUOUS`로 보존합니다. 제공자 상태는 대문자, 기존 RegionReference 상태는 기존 소문자 계약을 유지합니다.

현재 정규 사전 범위: 17개 시·도 및 기존에 검토된 일부 시·군·구(용인시·기흥구·평택시 등). 전국 시군구 정규 코드 registry는 아직 없습니다. 사전에 없는 행도 원본과 제공자 코드를 보존하지만 임의 프로필·지도에 연결하지 않습니다. 읍면동 자료는 더 넓은 구로 승격하지 않고 해상도를 유지합니다. 전국/시도 합계를 시군구 인구로 배분하지 않습니다.

## 출처와 비교

`RegionalMetric.structuredSource`에 provider, mode, tableId/tableName, organizationId, retrievedAt, providerRegionCode, itemId, periodType, normalizationStatus, RegionReference, rawSource를 저장합니다. 원본 `TBL_ID`, `ORG_ID`, `PRD_DE`, `C1`, `ITM_ID`, `DT`, `UNIT_NM` 등을 그대로 확인할 수 있습니다. 전체 메타데이터는 응답의 metadata에 별도 보존합니다. 출처 링크는 검증된 KOSIS 공식 서비스 주소이며 표 ID를 함께 표시합니다. 추측한 표 상세 URL은 생성하지 않습니다.

누락/비공개/비수치 값은 null, 실제 `0`만 0입니다. 인구는 비음수 안전 정수·명 단위를 확인합니다. 표·기관·항목·시점이 요청과 다르면 응답을 거부합니다. 문제 행은 원본 및 검증 보류 사유를 보존합니다.

KOSIS의 이 메타데이터 계약에서 행정 경계 개정 버전이 확인되지 않아 `boundaryVersion=null`입니다. 같은 제공자 코드만으로 동일 경계라고 가정하지 않습니다. 현재 실제 값 수신과 비교 가능성은 별도이며, 지역 비교와 증감 계산은 보류합니다. 향후 경계·정의·모집단·단위·주기·제공자 코드가 호환되는 시계열이 들어오면 시작/끝 시점과 원본 지표 ID, 표 ID, 절대 증감 및 `(latest-previous)/previous*100`을 보존합니다. 0/null 분모, 상충 수치, 호환되지 않는 조건은 계산하지 않습니다.

## 지역 엔진과 LIVE/DEMO 규칙

공식 총인구 행은 `STRUCTURED_REGIONAL_DATA`로 지역 프로필에 연결합니다. 총인구 스냅샷은 인구 변화 자체 또는 대상 연령 인구를 증명하지 않으므로 인구 차원의 보조(partial) 자료입니다. 시설·이슈 관련성이 검증되지 않은 총인구만으로 directEvidenceIds, Issue Signal, 지도 후보, 랭킹 또는 SUPPORTED 상태를 생성하지 않습니다. 기존 선택 이슈가 있는 경우 지역 상세에서 실제 지표를 함께 확인할 수 있습니다.

호환 증감은 DEMOGRAPHIC Phenomenon으로 표현할 수 있지만 관계와 건축 이슈는 자동 생성하지 않습니다. `시설 공급 데이터 필요`를 표시합니다. FacilityProfile의 사용자 정보는 요구사항 설명으로 사용하며 연령 범위는 별도 설정이 없으면 null입니다. 총인구에 가짜 연령 비율을 곱하지 않습니다.

모드 변경 시 수신 데이터와 진행 요청을 해제합니다. DEMO에서는 KOSIS 조회가 비활성화되고 LIVE 엔진은 mode=demo 구조화 지표를 제외합니다. 미연결 연령·시설·접근성·수요조사는 MISSING으로 표시합니다. 키 설정만으로 LIVE 배지를 표시하지 않으며 검증된 실제 수치가 수신되어야 LIVE입니다.

## 캐시와 오류

서버 메모리 캐시 기본 5분, 최대 64개. 키는 엔드포인트 및 표·시점·분류·항목 등 모든 요청 파라미터(인증키 제외)입니다. 클라이언트 인스턴스는 키별로 격리됩니다. 동시 동일 요청을 합치며 최소 1.1초 간격의 순차 요청, 요청당 15초 제한, 자동 재시도 없음입니다. 새 표 조회는 메타데이터 5개와 자료 1개 요청, 반복 조회는 캐시 사용. DB 없음.

서버 API는 로컬 동일 출처만 허용하고 임의 URL·표·쿼리를 브라우저에서 받지 않습니다. 누락 키, HTTP 인증 실패, KOSIS 오류 객체, 네트워크/시간 초과, HTML/잘못된 JSON, 빈 응답, 시점/항목 불일치를 구분합니다. 공급자가 돌려주는 오류 전문·요청 URL·키를 출력하지 않습니다. 실패 응답은 캐시하지 않습니다. 요청 실패는 기존 앱을 중단하지 않습니다.

## 검증

`tests/kosis.test.mjs`는 명시적인 TEST ONLY 응답으로 제공자·정규화·누락값·모호한 지역·여러 시점·캐시·오류·LIVE/DEMO 분리·지역 엔진 연결을 검증합니다. 실제 API 수치 검증과 구분해야 합니다. KOSIS 키가 없는 환경에서는 LIVE 검증 완료를 주장하지 않습니다.

이번 검증 결과: `npm run build` 통과. `node --test tests/kosis.test.mjs tests/regional.test.mjs` 25개 통과(신규 11 + 기존 지역 엔진 14). 실제 로컬 API의 미설정 config 및 population 503, 브라우저 DEMO/LIVE 전환·390px 화면을 확인했습니다. 성공 응답·출처 상세·모드 초기화·시간 초과 UI는 별도 TEST ONLY 브라우저 응답으로 확인했습니다. 브라우저 번들에 서버 KOSIS 요청 코드나 인증 파라미터가 포함되지 않는 것을 확인했습니다. 실제 KOSIS LIVE 수치 검증은 하지 못했습니다.


## 2026-09-22 실제 KOSIS 연결 검증 완료

이전 API 키 미설정 기록은 과거 상태입니다. 현재 실제 응답 → 정규 시군구 → UI LIVE 표시를 검증했습니다. 최신 2026-08 자료는 256개 시군구에 연결됐으며, 전체 103개 테스트와 빌드가 통과했습니다. 상세 수신 범위·실제 값·한계는 [검증 보고서](KOSIS_LIVE_CHECKPOINT.md)를 참조하세요. 과거 경계 동일성은 미검증이므로 증감 계산은 보류합니다.
