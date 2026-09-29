# LIVE DATA #2·#3 추가

주 지역 단위는 SIGUNGU입니다. 공식 MOIS 법정동 코드 registry(활성 269 / 중복 없는 분석 256) → KOSIS 명시 연령 인구 및 어린이집 cpmsapi030 → 호환 지표·관계 → 확장 RegionEvidenceProfile → 기존 KoreaMap/RegionDetail의 시군구 경로를 사용합니다. 공급은 시설별 registry와 별도 provider로 분리했습니다. 지도는 출력이며 후보를 생성하지 않습니다. 실제 API 키가 없으면 모든 숫자는 MISSING입니다. 과거 경계·같은 기준일이 미검증이면 증감·비율·관계를 보류합니다.

[시군구 인구 설계](SIGUNGU_TARGET_POPULATION.md) / [시설 공급 설계](LIVE_DATA_FACILITY_SUPPLY.md). 아래 이전 단계 기록의 전국 코드/연령 제공자 미구현 설명은 새 경로에 한해 갱신되었습니다.

# LIVE DATA #1 추가

KOSIS 서버 API → RegionalDataProvider → RegionalMetric (출처·원본 보존) → 기존 지역 엔진의 구조화 인구 맥락 → 지역 프로필로 연결합니다. KOSIS 키와 요청은 서버에만 존재합니다. 총인구는 건축 이슈의 직접 검증이나 순위 근거가 아니며, 연령·시설 공급·경계 버전이 미연결이면 MISSING/비교 보류로 유지합니다. 이전 단계의 구조화 데이터 미구현 설명은 이 경로에 한해 갱신되었습니다. [상세 설계](LIVE_DATA_KOSIS.md).

# 현재 아키텍처: 지역 근거 검증 후 지도

선택 이슈 → 지역 근거 요구·발견·추가 검증 → 행정 단위 검증·지역 비교 → 직접 근거가 있는 시·군·구 → 실제 지도 → 지역 상세·문제 정의.

`RegionalEvidenceExplorer`가 선택 이슈의 검색·검증 상태를 소유하고 기존 GeographicOverview에 엔진 결과를 전달합니다. `regionalEvidenceEngine`은 원문 행정 단위·직접성·coverage·지표 비교 조건으로 지도 진입을 결정합니다. `RegionEvidenceProfile.regionalAssessment`를 추가해 기존 계약을 유지합니다. 서버는 이슈 유형·단계·정규 지역 ID를 검증하고 제한된 쿼리를 재구성합니다.

정확한 계약과 한계는 [REGIONAL_EVIDENCE_ENGINE.md](REGIONAL_EVIDENCE_ENGINE.md)에 기록합니다. TOP 50 요구는 제거했으며 지도 폴리곤은 후보를 생성하지 않습니다. 아래 이전 #5/#6 기록의 점수와 최대 50 설명은 현행 지도 진입 기준이 아닙니다.

## 이전 이슈 분석 모듈 기록

시설 맥락 → 현상 탐색 질문 → 기존 Evidence Explorer/Analyzer → Phenomenon → PhenomenonRelationship → ArchitecturalIssue 선택 → issue-linked Geographic Mapper → Region Detail → Problem Definition.

`services/issues`는 질문 생성·명시 인용 기반 관계 후보·공간 질문 합성·이슈별 지역 연결을 추가합니다. `IssueExplorer`가 이슈 선택 상태를 소유하며, 선택 이후 기존 `GeographicOverview`를 연결합니다. `ProblemDefinition`은 선택 이슈/지역의 근거 스냅샷과 사용자 편집을 분리합니다. 모드·시설·이슈·지역 변경으로 결과가 섞이지 않도록 초기화합니다.

SOURCE / EVIDENCE / PHENOMENON / RELATIONSHIP / ISSUE / REGION / PROBLEM DEFINITION의 구분과 새 확신도는 [ARCHITECTURAL_ISSUE_MODEL.md](ARCHITECTURAL_ISSUE_MODEL.md), #6 생성·수정·추적은 [PROBLEM_DEFINITION.md](PROBLEM_DEFINITION.md)에 정의합니다. Facility Demand Finder의 시설 부족→지역 순위 중심 방향은 deprecated입니다. 아래 #1–#5 기록은 재사용하는 하위 모듈의 역사와 계약입니다.

현재 LIVE 제공자는 원문 추출·관련성 의미 판정을 하지 않으므로 이슈 도출이 보류될 수 있습니다. DEMO는 별도 가상 시나리오이며 실제 관찰과 혼합하지 않습니다. UI의 Issue Signal은 #5 candidateScore를 이슈 연결 근거에 한정해 재사용합니다.

---

# Architecture — Evidence Explorer

## 제품 정의

설계하고자 하는 시설을 입력하면 법령, 연구, 수요조사, 설문, 통계, 기사 등 다양한 근거자료를 탐색·분석하여 시설이 필요한 지역 후보와 그 이유를 제시하는 AI 기반 건축 문제정의 탐색기.

## 파이프라인

```text
USER INPUT
  ↓
Facility Interpreter                  [#2 구현: 로컬 규칙]
  ↓ FacilityProfile
Evidence Search Planner               [#2 구현: 계획만 생성]
  ↓ EvidenceSearchPlan
Evidence Explorer                     [#3: 검색 메타데이터·원문 URL 수집]
  ↓ EvidenceItem[]
Evidence Analyzer                     [#4: 메타데이터 규칙 평가·가용항목 평균]
  ↓ EvaluatedEvidenceItem[]
Strong Evidence Selection             [#4: 품질 우선·유사강도 내 다양성]
  ↓
Geographic Evidence Mapper            [#5: 명시 지명 정규화·연결]
  ↓ RegionEvidenceProfile[]
Candidate Score / Confidence          [#5: 가용 축 평균·충분성 검사]
  ↓ CandidateRegion[]
Candidate Regions                     [#5: 최대 50개, 채우기 금지]
  ↓
WHY THIS REGION? / Region Detail
  ↓
3–5 strongest evidence items + Source + Date + Original Link
```

## #2 모듈 경계

- `interpretFacility(input): Promise<FacilityProfile>`: 원문, 시설명·분류, 핵심·관련 이용자, 주요 기능, 문제 영역, 해석 상태·방법·안내를 반환합니다. 미래 AI 해석기는 같은 `FacilityInterpreter` 계약을 구현합니다.
- `facilityCatalog`: 9개 예시 정의만 갖는 로컬 설정입니다. 띄어쓰기 정규화와 별칭 매칭, 명시된 청소년·노인 이용자 조건을 처리합니다. 의미를 완전히 이해하는 자연어 모델은 아니며 부정·복잡한 의도는 해석하지 못할 수 있습니다.
- 미등록 또는 여러 시설이 일치하면 원문을 보존하고 `needs_clarification`으로 표시합니다. 특정 시설에 강제로 매칭하지 않습니다. 이용자·기능은 빈 배열로 두며 일반적인 문제 영역을 탐색하기 위한 임시 계획을 제공합니다.
- `planEvidenceSearch(profile): EvidenceSearchPlan`: 입력 문자열 대신 프로필의 시설명·유형·이용자·기능·문제 영역을 사용합니다. 순수 계획 생성이며 네트워크 요청은 없습니다.
- `PlannedSearch`: 유형, 검색어, 목적, 검색 우선순위, 대한민국 범위, 선호 출처 유형을 저장합니다. 우선순위는 검색 순서의 의미이며 증거 중요도·신뢰성의 점수가 아닙니다.
- UI는 시설 해석·계획 완료 후 사용자 요청으로 DEMO/LIVE 탐색을 실행합니다. 근거 분석은 #4의 메타데이터 규칙 평가를 연결하고, #5는 명시 지명 연결·후보 충분성 검토를 수행합니다. 확인 필요 프로필은 임시 계획임을 추가 표시합니다.

## 근거 유형별 탐색 관점

| 유형 | 탐색 관점 |
| --- | --- |
| LAW_POLICY | 설치·운영 기준, 제도와 정책 |
| RESEARCH | 수요·접근성·입지의 선행 연구 및 한계 |
| PUBLIC_REPORT | 공공기관의 현황 진단과 중장기 계획 |
| DEMAND_SURVEY | 이용 의향, 지역사회 수요, 조사 대상·시점 |
| SURVEY | 만족도·불편·요구, 표본과 질문 구성 |
| STATISTICS | 이용자·시설 공급·이용의 정량 현황, 기준연도·지역 단위 |
| NEWS | 최근 지역 현안의 단서, 원자료 교차 확인 |

계획에 '시설 부족'이 포함되어도 실제 부족을 확인했다는 뜻이 아닙니다. 법령명, 논문, 통계, 기사, URL, 검색 결과는 #2에서 생성하지 않습니다.

## 출처 추적 계약 — 발견 메타데이터와 미래 추출 필드

`EvidenceItem`은 제목, 원문 기관, 발행일(미상은 null), 실제 원문 URL, 수집일, 유형, 지역 범위, 언급 지역, 요약, 추출 주장, 정량 값을 보존합니다. 주장·수치에는 원문 발췌와 페이지·표·문단 위치를 연결할 수 있습니다. 수치는 단위·기준 기간·지역 범위를 따로 보존합니다.

`evaluation`의 신뢰성, 관련성, 최신성, 지역 특정성, 구체성은 평가 전 `null`입니다. 이 원본 필드를 바꾸지 않고 #4의 별도 EvaluatedEvidenceItem에서 0–100 점수·이유·미평가 상태와 가용 항목 평균을 계산합니다. LAW = 30, RESEARCH = 25 같은 유형별 고정 가중치는 금지합니다. 오래된 논문보다 최근 공식 수요조사가 적절할 수 있으며, 기사와 공식 통계를 같은 성격의 자료로 취급하지 않습니다.

`CandidateRegion`은 지역 식별자, 설명과 근거 ID 연결, 3–5개 핵심 근거 ID를 담을 미래 계약입니다. 실제 생성, 증거 선택, 점수와 순위는 구현하지 않습니다. 미래 단계에서 원문 URL·ID 참조·주장 위치의 유효성을 검증해야 합니다. 타입만으로 실제 출처의 진위를 보장하지는 않습니다.

## AI 책임

허용: 시설 의도 해석, 검색 전략 생성, 출처 분류, 수집 원문 요약, 지리적 참조 추출, 근거 비교, 근거가 중요한 이유 설명.

금지: 법령·논문·수요조사·설문·통계·기사 내용·출처 URL을 꾸며내거나 지역별 근거를 생성하는 행위. 모든 최종 주장은 실제 수집 원문으로 추적 가능해야 합니다.

## #1 호환성과 범위

기존 KoreaMap, RankingPanel, RegionDetail은 #5의 지역별 실제 연결 데이터 계약으로 재사용·갱신했습니다. 과거 EvidenceCard·MOCK DATA는 보존하지만 후보 생성에는 사용하지 않습니다. 기존 Need Score 문서는 미래·보조 설계이며 현재의 주 흐름이 아닙니다.

현재는 React/Vite와 Vite 내부의 작은 로컬 API를 실행합니다. 키가 설정되면 서버에서 Brave Web Search API를 호출합니다. 공격적 크롤링, 원문 전문·PDF 추출, LLM, 데이터베이스, 인증, 지역 분석·순위, 배포는 구현하지 않습니다. 근거 평가는 #4에서 메타데이터 규칙으로만 수행합니다.


## #3 구현 경계

```text
FacilityProfile + EvidenceSearchPlan
  → queryBuilder: 시설별 쿼리, 도메인 선호, 결과 상한
  → searchOrchestrator: 유형별 제공자 선택, 전역 순차 큐, 메모리 캐시
  → SearchProvider[]: brave-web (LIVE) / demo-fixture (DEMO)
  → RawSearchResult[]
  → evidenceNormalizer: 텍스트 정리, URL 검사, 날짜·명시 지명 처리
  → URL 중복 제거 → EvidenceItem[]
  → evidenceExplorer: 카테고리 진행 상태와 정규화 결과 전달
  → EvidenceExplorer UI: 모드, 분류·지역 필터, 건수, 원문 링크
```

`GET /api/evidence/config`는 설정 여부와 공개 제한만 반환합니다. `POST /api/evidence/search`는 입력·카테고리·모드를 검증하고 서버에서 시설 프로필·검색 계획을 재생성하여 한 카테고리를 검색합니다. 클라이언트가 임의 API URL·키·무제한 쿼리를 전달할 수 없습니다. UI는 이 중립적인 응답만 사용하며 Brave 인증·응답 파싱을 포함하지 않습니다.

Vite의 `configureServer`와 `configurePreviewServer`에 같은 API를 연결합니다. 비밀값은 `loadEnv`와 프로세스 환경에서 서버만 읽습니다. `VITE_` 접두사·클라이언트 define·응답·로그로 노출하지 않습니다. 로컬 호스트 요청만 허용하고 다른 origin에서 호출한 요청은 거절합니다. 독립 배포용 서버가 아닌 로컬 개발/미리보기 구조입니다.

## 제공자와 실행 제어

`SearchProvider`는 `id`, `mode`, `configured`, `categories`, `search(query, signal)`을 제공합니다. `brave-web`은 실제 검색 결과만 반환하고 `demo-fixture`는 명시적인 DEMO 텍스트와 null URL만 반환합니다. LIVE에 원문 URL이 없거나 HTTP(S)가 아니면 해당 결과는 제외합니다. LIVE 실패 시 DEMO로 전환하지 않습니다.

전용 법령·학술 API는 아직 없으며 Brave Web Search와 유형별 도메인 제한 검색을 사용합니다. 법령·정책은 정부/법령 도메인, 연구는 학술 색인, 보고서·조사는 정부/연구기관, 통계는 통계·공공데이터 도메인을 선호합니다. 뉴스는 일반 검색입니다. 도메인이나 탐색 유형은 자료의 진위·신뢰성·정확한 유형을 보증하지 않습니다.

새 제공자는 서버 `providers/`에 인터페이스를 구현하고 `api.ts`의 LIVE 제공자 배열에 등록합니다. 고유 ID와 지원 유형을 선언하고 공개 응답만 `RawSearchResult`로 매핑합니다. 정상화·UI는 변경하지 않습니다. 여러 제공자 중 일부가 실패하면 나머지 제공자의 결과를 유지합니다.

기본값: 유형별 쿼리 2개, 결과 5개, 요청 동시성 1, 시작 간격 1100ms, 개별 요청 제한 12초. 최대 쿼리는 유형당 3개, 결과는 쿼리당 10개입니다. 여러 브라우저 탭도 동일 서버 큐를 공유하며 큐 대기를 30개로 제한합니다. 401/403/429는 쿼리 반복을 중단하고 60초 억제합니다. 자동 재시도는 없습니다. 중단 또는 새 시설 입력 시 진행 요청을 취소하고 오래된 결과를 UI에 반영하지 않습니다.

카테고리는 `waiting → searching → complete / partial / error / unconfigured / cancelled` 상태를 가집니다. 완료는 발견 작업 종료이며 근거 검증 완료가 아닙니다. 비율을 꾸며내지 않습니다. 오류는 정제된 메시지만 UI에 표시하고 개발 로그에는 제공자 ID·유형·고정 오류 코드만 남깁니다.

메모리 캐시는 제공자·모드·검색어·도메인·결과 수로 구분합니다. 성공 결과(빈 배열 포함)만 최대 200개, 기본 300초 동안 보관합니다. 실패는 캐시하지 않습니다. 동일 쿼리는 공유 큐 안에서 다시 캐시를 확인하므로 동시 요청도 중복 호출을 줄입니다. `retrievedAt`은 재사용 시 갱신하지 않습니다. 데이터베이스·디스크 저장은 없습니다.

## #3 메타데이터 보존과 정규화

- 원문 URL은 공급자 값을 보존합니다. 중복 키는 추적 파라미터와 일반 앵커를 제거하고 파라미터를 정렬합니다. 식별용 파라미터와 SPA 라우트는 유지합니다. 제목 유사도 추론은 하지 않습니다.
- 여러 검색에서 같은 URL을 찾으면 `categories`와 `discoveryQueries`를 병합합니다. 분류는 검색 목적에서 가져오는 임시 분류이며 문서 내용 기반 판정이 아닙니다.
- `sourceOrganization`은 공급자가 실제 기관 메타데이터를 제공한 경우에만 저장합니다. Brave의 사이트 표시명은 `sourceLabel`로 분리합니다.
- Brave `page_age`는 수정일일 수도 있으므로 `providerDateHint`에 보존하고 `publishedDate`를 null로 둡니다. 날짜를 스니펫이나 연도 문자열에서 추측하지 않습니다. 향후 명시적 발행일 제공자가 있으면 형식 검증 후 저장합니다.
- `retrievedAt`은 API 응답을 받은 시각입니다. `snippet`은 발견 메타데이터이며 새 주장이 아닙니다. `summary`는 빈 문자열, `extractedClaims`와 `quantitativeEvidence`는 빈 배열, `evaluation`은 모두 null입니다.
- 지명은 제목·스니펫에 명시된 소규모 목록의 정확한 표기만 추출합니다. 광주광역시·용인시·평택시 등을 지원하지만 모든 시군구를 망라하지 않습니다. `regionCode`는 null, `geographicScope`는 원문 범위 미확인입니다. 지명 언급만으로 시설 부족·필요 지역을 추론하지 않습니다.
- DEMO는 가상 자료임을 제목·본문·배지로 표시하고 기관·날짜·통계·URL을 생성하지 않습니다. 원문 보기 링크도 제공하지 않습니다. 모드 변경 시 결과·필터·진행 상태를 초기화합니다.

## 설정 및 검증 범위

`.env.example`에 키 이름만 보관합니다. `BRAVE_SEARCH_API_KEY`는 LIVE에 필요합니다. `SEARCH_QUERIES_PER_CATEGORY`, `SEARCH_RESULTS_PER_QUERY`, `SEARCH_CACHE_TTL_SECONDS`, `SEARCH_MIN_INTERVAL_MS`는 선택 설정입니다. 기본값·상한·실행 명령은 README에 정리했습니다. 키가 없으면 앱과 DEMO는 정상 작동하고 LIVE는 설정 안내를 표시합니다.

공식 API 참조: https://api-dashboard.search.brave.com/api-reference/web/search/get

서비스 테스트와 실제 브라우저의 DEMO/실패/빈 결과 흐름을 검증했습니다. 실제 API 키가 없어 LIVE 왕복은 미검증이며 테스트용 응답을 실제 수집 근거로 표시하지 않습니다. #4는 아래의 제한된 메타데이터 평가만 수행하며 #5는 아래 지역 연결 범위만 수행하며 #6은 아래 별도 서비스에서 수행합니다.


## #4 평가와 선정 경계

`analyzeEvidence(item, facility, plan?, options?) → EvaluatedEvidenceItem`는 React 밖의 서비스입니다. 입력 객체를 수정하지 않으며 출처·모드·날짜·분류·지역 정보를 유지합니다. 컬렉션 경계는 URL 중복을 제거한 자료를 평가합니다.

- `analysis/deterministic.ts`: 추적 가능한 출처 메타데이터, 확인된 발행일과 자료 맥락, 명시 지명의 수준, 제목·스니펫의 수량·조사·비교 표현을 평가합니다. 없는 정보에는 null을 반환하고 사유를 남깁니다. 도메인만으로 신뢰성을 매기거나 학술자료를 동료심사 자료라고 가정하지 않습니다.
- `analysis/semantic.ts`: 시설명·이용자·기능·문제영역·탐색계획을 의미 분석기에 전달할 계약을 둡니다. 현재 외부 LLM은 연결하지 않았으며 관련성은 requires_semantic_analysis, 역할과 stance는 UNKNOWN입니다. 일치 표현 목록은 점수가 아닙니다.
- `analysis/evidenceAnalyzer.ts`: 기본 동일 가중치의 가용 항목 평균, 완성도, 포함/미평가/가중치 제외 항목, 계산식, 평가 시각·버전을 보존합니다. `analysisDepth`는 metadata_only입니다.
- `analysis/config.ts`: 점수 규칙·기간 구간·가중치·라벨·선정 임계값을 집중 관리합니다. 타입만으로 평가 타당성이 보증되는 것은 아니며 전문가 검증 모델이 아닙니다.
- `analysis/selection.ts`: 기본 근거 강도순, 발행일 기준 최신순, 유형순 정렬과 품질 필터·요약·Top Evidence를 계산합니다. 최소 강도·완성도 통과 후 비슷한 강도 안에서만 유형 다양성을 고려합니다.
- `EvidenceAssessment`: 강도·완성도와 접힌 평가 이유를 보여줍니다. 기본 카드는 간결하게 유지하고 상세에는 다섯 항목의 점수·사유·신호·계산식을 표시합니다.

기본 `EvidenceStrength = sum(평가된 점수) / count(평가된 항목)`이며 소수점 한 자리로 반올림합니다. null은 0점으로 치환하지 않고, 실제 평가된 0점은 포함합니다. 가용 점수가 없으면 종합 점수도 null입니다. 기본 다섯 가중치는 모두 1이며 나중에 EvidenceWeightConfig를 교체할 수 있습니다. AHP는 구현하지 않습니다.

`evidenceRole`은 DIRECT / CONTEXT / UNKNOWN, `stance`는 SUPPORTS_NEED / WEAKENS_NEED / NEUTRAL / UNKNOWN입니다. 현재는 의미 판정이 미실행이라 UNKNOWN이며, 숫자·지명·시설명만으로 직접 수요 근거를 주장하지 않습니다. 향후 의미 분석 결과는 이유와 실제 수집 텍스트 인용을 요구하고 응답 실패 시 규칙 평가는 보존합니다.

기관 식별 정보가 많더라도 진위·조사 방법·수치 정확성을 검증하지 않습니다. 법령 표현은 발행일만으로 현행성 평가를 하지 않습니다. 날짜가 없는 Brave 자료는 최신성도 미평가입니다. 미평가가 많으면 강도 수치만으로 비교하지 않도록 완성도와 한계를 함께 표시합니다.

탐색은 시설 건립을 지지하는 자료에 편향되어서는 안 됩니다. 수요 감소, 충분한 기존 공급, 유휴시설, 다른 자료와 모순되는 결과도 유지합니다. 뉴스·조사 주제에 이용 감소·미이용 이유 관점을 포함하고, 수요 지지 여부로 결과를 삭제하거나 Top Evidence에 가산하지 않습니다.

수집 중에는 도착한 결과부터 평가합니다. 전체 요약과 필터 결과의 Top Evidence는 현재 자료에서 파생하며 모드·시설 변경 시 초기화합니다. DEMO 평가에는 가상 표시를 유지하고 LIVE는 수집된 메타데이터만 평가합니다.

기존 #3 및 #4의 26개 서비스 테스트, Chrome의 DEMO/시험 응답 기반 LIVE 표시로 결측값·약한 정보·자료별 규칙·원문 보존·중복·상반된 자료·정렬·필터·수식·모바일 동작을 확인합니다. 실제 LIVE 검색은 API 키가 없어 미검증입니다.

상세 규칙과 한계는 [EVIDENCE_EVALUATION.md](EVIDENCE_EVALUATION.md)에 기록합니다. 다음 단계는 EvaluatedEvidenceItem을 받아 지역 프로필에 연결할 수 있으나, #4는 평가만 담당하고 #5의 Geographic Mapper와 후보 점수는 아래 별도 서비스에 연결합니다. 최종 입지 추천은 구현하지 않습니다.


## #5 지역 근거와 후보 발견

`mapGeographicEvidence(EvaluatedEvidenceItem[], mode)`는 모드를 분리하고 URL 중복을 제거한 뒤 명시 지명을 정규화합니다. 결과는 RegionMapping[], RegionEvidenceProfile[], candidates, nationalContext, unresolved입니다. 원래 평가 자료를 변경하지 않습니다.

`regionCatalog`는 소규모 공식 명칭·별칭 사전이며 내부 키만 제공합니다. `regionNormalizer`는 전체 연속 표기를 우선하고 모호한 광주·중구 등을 배제합니다. 관련 없는 발행기관·도메인·연락처로 지역을 추론하지 않습니다. 전국 범위 자료를 모든 도시로 전파하지 않고, 상위/하위 지역으로 자동 확장하지 않습니다.

`candidateScore`는 출처·동일 제목 그룹당 대표 1개와 유형당 최대 2개의 기여 상한을 적용합니다. 근거 강도·판정된 직접성·출처 다양성·주 유형 다양성·지역 구체성의 가용 축을 기본 동일 가중 평균으로 계산합니다. 자료 충분성 미달이면 점수는 null이며 순위 밖에서 근거를 보존합니다. 점수와 별도로 Confidence를 계산하고 강한 수요 약화 근거는 확신도에 반영합니다.

근거 지지·약화·배경·미판정 배열과 mapping의 인용, 점수 계산에 쓰인/제외된 ID, 축별 근거를 보존합니다. WHY는 이 기존 메타데이터만 읽는 템플릿이며 새로운 시설 필요성 결론을 만들지 않습니다. 의미 분석기가 없는 현재는 지역 직접성·수요 방향이 UNKNOWN일 수 있어 Confidence를 높이지 않습니다.

`GeographicOverview`는 전체 평가 결과에서 지역 프로필을 파생합니다. 자료 목록의 강도/유형 필터로 후보가 변하지 않으며 지역 검색은 표시만 바꿉니다. KoreaMap·RankingPanel은 같은 지역 ID로 선택을 동기화하고 RegionDetail 유형 필터는 원래 점수를 재계산하지 않습니다. 전국 배경, 미확인 지명, 추가 확인 지역을 별도 보존합니다.

지도는 임의의 권역 개략 배치이며 경계·좌표 자료가 아닙니다. 행정코드, 전국 전수 사전, 장소별 의미 관계 추론과 최종 입지는 미구현입니다. 필지·토지 가격·용도지역·설계 생성·데이터베이스·배포는 추가하지 않았습니다.

구체 규칙과 근거 명칭 출처: [GEOGRAPHIC_MAPPING.md](GEOGRAPHIC_MAPPING.md). 점수/확신도/반복 기여 제한: [CANDIDATE_SCORE.md](CANDIDATE_SCORE.md). 문제 정의는 아래 #6에서 연결합니다.

## #6 문제 정의와 연결

`generateProblemDefinition(ProblemInput)`은 이슈에 연결된 지역/전국 근거를 주장으로 추출·병합하고, 적격 인용만 5개 항목에 연결합니다. 미지원 항목·저확신 주장·결측 자료 유형·오래된 자료는 gaps로 보존합니다. `regenerateSection`은 최초 입력 스냅샷으로 한 항목만 복원하며 네트워크 호출이 없습니다. `SectionDraft`는 사용자 수정임을 표시하고 원래 EvidenceItem을 변경하지 않습니다. 모든 사실 문장은 claimIds/evidenceIds로 추적됩니다. 설계 질문은 답이나 사실 주장이 아닙니다.

## 실제 시·도 지도

KoreaMap은 data/geography의 GeoJSON을 불러와 검증·동일 축척 투영합니다. services/geography/boundaries가 geometry, 투영, 코드/이름 join을 분리합니다. geographic mapper와 점수 산식은 변경하지 않고 임의 mapPosition 필드만 제거했습니다. 시·도 선택은 기존 profile ID 또는 boundary:sourceCode로 구분하여 자료 없는 지역의 가짜 프로필을 생성하지 않습니다. 시·군·구 경계는 향후 BoundaryLayer로 확장합니다. 자세한 출처는 data/geography/README.md에 기록했습니다.


### LIVE DATA #3 보완 검증 (2026-09-21)

수요·공급 파생 지표는 동일 지표·단위·대상 인구 정의·인구 모집단·시설 정의·SIGUNGU 수준·기준일의 집단에서만 비교합니다. 2개 이상의 고유 지역에 중간 순위 백분위 `100 × (낮은 값 개수 + 동률 개수 / 2) / 집단 크기`를 적용합니다. DEMO, 비유한 값, 중복 지역은 비교에서 배제합니다. 상세 화면에서 원값·백분위·집단 크기·시점과 입력 호환성 사유를 확인할 수 있습니다. 시설 수 및 정원/1,000명 지도를 제공하며 자료가 없으면 N/A입니다.

공급 품질에는 정원·현원 누락 비율(활성 시설 분모), 기준일·운영 상태 확인 비율(고유 시설 분모)이 포함됩니다. 분모가 없으면 null입니다. 공급 집계는 시설 유형·제공자·데이터셋·활성 정의를 인자로 받으며, 첫 공식 제공자는 어린이집입니다. 검증된 관계는 기존 Phenomenon/PhenomenonRelationship 형식으로 연결하고 지역 상세에서 건축 질문 → 관계 → 현상 → 입력 지표 → 출처를 추적합니다. Issue Signal은 임의 가산하지 않습니다.

실제 인증키는 KOSIS·어린이집 모두 MISSING으로 확인했습니다. `LIVE VALIDATION BLOCKED — API KEY REQUIRED`. 현재 실제 시설 LIVE 지표 및 실제 사례는 없으며, 256개는 분석 가능한 행정구역 수이지 시설 데이터 확보 지역 수가 아닙니다.
