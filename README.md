# Architectural Issue Explorer

설계하고 싶은 시설에서 사회·인구·도시·공간의 변화를 탐색하고, 현상 간 관계에서 건축적으로 다룰 수 있는 이슈를 발견하는 프로토타입입니다. 시설 부족이나 신축 필요성을 전제하지 않습니다.

**현재 범위: 지역 근거 엔진 + 이슈 중심 분석·문제 정의.** 이전 Facility Demand Finder / Facility Need Finder의 수요·순위 중심 제품 방향은 deprecated입니다. 저장소·패키지 이름과 기존 데이터 계약은 유지합니다.

`시설 이해 → 현상 탐색 → 근거 분석 → 관계·건축 이슈 → 지역 근거 발견·검증 → 지역 비교 → 직접 근거가 있는 시·군·구 → 실제 지도 → 문제 정의`

- 시설별 이용자·기능을 바탕으로 9종 현상 질문을 만들고, 기존 7종 출처 검색 전략과 연결합니다.
- 기존 검색·중복 제거·평가·전국/지역 연결·지도·지역 상세를 재사용합니다.
- 이슈별 지역 검증 질문을 만들고, 직접 근거 확인과 비교를 거친 시·군·구만 지도 신호에 연결합니다. 지역 점수 표시는 Issue Signal입니다.
- 원문 관계 표현과 공간적 검토 단서가 있는 이슈 후보만 구성하며, 인과관계를 새로 주장하지 않습니다.
- 5개 문제제기 항목, 출처 추적, 사용자 수정 표시, 같은 근거로 항목별 재생성을 제공합니다.
- 현재 기본은 **MOCK / DEMO**입니다. 가상 이슈의 confidence는 INSUFFICIENT이며 실제 사실 항목은 판단 보류입니다.
- LIVE에는 서버 BRAVE_SEARCH_API_KEY가 필요합니다. 현재 검색은 메타데이터만 수집하므로 원문 추출·관련성 판정이 없는 LIVE 결과에서는 이슈 도출을 보류합니다. 실제 API 왕복은 키가 없어 미검증입니다.
- 최종 입지·필지 선택, 설계 생성과 다음 단계는 구현하지 않았습니다.

모델·한계: [ARCHITECTURAL_ISSUE_MODEL.md](docs/ARCHITECTURAL_ISSUE_MODEL.md). 생성·편집·추적: [PROBLEM_DEFINITION.md](docs/PROBLEM_DEFINITION.md).

## 로컬 실행

Node.js 22.14 이상과 npm이 필요합니다. 프로젝트 루트에서:

```sh
npm install
npm run dev -- --port 5173 --strictPort
```

주소: http://127.0.0.1:5173

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

빌드 미리보기: http://127.0.0.1:4173

현재 머신의 검증용 임시 Node.js가 남아 있다면:

```sh
PATH=/tmp/node-v22.14.0-darwin-arm64/bin:$PATH npm run dev -- --port 5173 --strictPort
```

임시 폴더가 정리되면 Node.js 22.14 이상을 설치하고 일반 실행 명령을 사용하세요. #3에서는 서버 타입 검사용 `@types/node`만 개발 의존성으로 추가했습니다. Vite의 로컬 API가 dev와 preview 양쪽에서 작동하므로 별도 서버 실행 명령은 없습니다. `dist` 파일만 정적으로 열면 LIVE API는 동작하지 않습니다.

## 데이터 흐름 및 파일

`입력 → FacilityProfile → EvidenceSearchPlan → Query[] → SearchOrchestrator → SearchProvider[] → RawSearchResult[] → Normalizer → EvidenceItem[] → Evidence Analyzer → EvaluatedEvidenceItem[] → Phenomenon / Relationship → ArchitecturalIssue 선택 → Issue-linked Geographic Mapper → Issue Signal / 지역 상세 → Problem Definition`

- `frontend/services/issues/`: 현상 질문·관계·이슈 합성·이슈별 지역 연결
- `frontend/services/problemDefinition/`: 주장 추출·가용 축 강도·출처 연결·문제 정의
- `frontend/components/IssueExplorer`, `ProblemDefinition`: 이슈 선택·관계도·편집 가능한 발표 구조
- `tests/issues-problem.test.mjs`: 네 시설·약한 근거·상반 자료·추적·재생성 검증
- `frontend/evidenceTypes.ts`: 시설·근거·출처 메타데이터와 미래 평가 계약
- `frontend/services/evidence/`: 쿼리 생성, URL 정규화·중복 제거, 탐색 상태 연결
- `frontend/services/geography/`: 지역 사전·정규화·명시 근거 연결·출처 기여 제한·후보 점수/확신도
- `frontend/components/GeographicOverview/`: 지역 검색, 전국 배경, 미확인·정보 부족 지역
- `frontend/components/KoreaMap`, `RankingPanel`, `RegionDetail`: 후보 지역 선택 연동과 실제 연결 근거
- `frontend/services/evidence/analysis/`: 규칙 평가·의미 분석 경계·설정·강도 계산·정렬·선정
- `frontend/components/EvidenceAssessment/`: 평가 요약, Top Evidence, 접힌 항목별 이유와 계산식
- `backend/evidence/`: 로컬 API, 순차 오케스트레이터, 메모리 캐시, Brave·DEMO 제공자
- `frontend/components/EvidenceExplorer/`: 모드·진행 상태·건수·유형/지역 필터·원문 링크
- `vite.config.ts`: 서버 전용 환경변수와 로컬 API 연결
- `.env.example`: 필요한 환경변수 이름만 제공
- `tests/evidence.test.mjs`: 서비스 경계·오류·출처 보존 검증
- `frontend/data/facilityCatalog.ts`: 작은 로컬 시설 설정
- `frontend/services/interpretFacility.ts`: 교체 가능한 비동기 해석 인터페이스
- `frontend/services/planEvidenceSearch.ts`: 프로필에서 탐색 목적·주제·검색어·선호 출처 생성
- `frontend/components/AnalysisSummary`, `EvidencePlan`, `AnalysisPipeline`: 해석·계획·단계 표시
- `frontend/App.tsx`: 해석과 계획 연결 및 UI 상태
- `frontend/types.ts`, `frontend/data/mockAnalysis.ts` 및 기존 지도·순위 컴포넌트: #1 보존용

해석기만 `FacilityInterpreter` 계약을 구현한 미래 AI 제공자로 교체할 수 있습니다. 검색어는 계획일 뿐이며, 검색 결과나 시설 부족의 증거가 아닙니다. 모든 `priority`는 현재 `normal`이며 검색 순서용 필드입니다. 근거의 중요도나 점수로 사용하지 않습니다.

## 출처와 AI 책임

AI는 시설 의도 해석, 검색 전략 수립, 출처 분류, 원문 요약, 지명 추출, 근거 비교 및 의미 설명을 지원할 수 있습니다. 법령·논문·수요조사·설문·통계·기사 내용·URL·지역 근거를 만들어내서는 안 됩니다.

최종 주장은 실제 수집된 원문에 연결되어야 합니다. `EvidenceItem`은 제목, 기관, 사이트 표시명, 스니펫, 발행일, 원문 URL, 발견 시각, 검색 제공자, 모드, 검색어·분류, 지역 언급 및 미래 추출 주장·수치 필드를 보존합니다. 현재 요약·추출 주장·수치 배열은 비어 있습니다. #3 원본 평가 필드는 null로 보존하고 #4 `EvaluatedEvidenceItem`에서 점수·이유·미평가 상태를 별도로 계산합니다. 원문에 날짜가 없으면 `null`로 남기고 추정하지 않습니다.

개별 자료는 신뢰성·관련성·최신성·지역 구체성·근거 구체성의 다섯 항목으로 평가합니다. **자료 유형만으로 고정 점수를 부여하지 않습니다.** 의미 분석이 필요한 관련성은 현재 미평가입니다.

상세 설계: [ARCHITECTURE](docs/ARCHITECTURE.md). 기존 점수 설계는 [SCORING](docs/SCORING.md)에 미래·보조 단계로 보존합니다.


## DEMO / LIVE 설정

기본 미리보기는 **MOCK / DEMO**이고 현재 활성 제공자는 `demo-fixture`입니다. 가상 자료에 DEMO 표시를 붙이며 기관·발행일·통계·원문 URL을 꾸며내지 않습니다. 가상 지역 언급은 필터 시연용 문자열로 표시합니다. 모드나 시설을 바꾸면 이전 결과를 지우며 LIVE 실패 시 DEMO를 대신 반환하지 않습니다.

LIVE 제공자는 **Brave Web Search (`brave-web`)**입니다. [공식 Web Search API 문서](https://api-dashboard.search.brave.com/api-reference/web/search/get)를 기준으로 구현했습니다. 키 설정:

```sh
cp .env.example .env
```

`.env`의 `BRAVE_SEARCH_API_KEY`에 Web Search API 사용 권한이 있는 키를 입력한 뒤 Vite 서버를 재시작하세요. 브라우저에서 시설을 분석하고 **LIVE SEARCH → 근거 탐색 시작**을 선택합니다. 실제 검색은 제공자 계정의 사용량을 소비합니다.

키가 없으면 앱은 정상 실행되며 **“검색 API가 설정되지 않았습니다.”**를 표시합니다. LIVE 시작 버튼은 비활성화되고 DEMO는 사용할 수 있습니다. 키는 `VITE_` 접두사를 사용하지 않고 서버 전용으로 읽습니다. `.env`는 Git 제외 대상이며 클라이언트 응답·번들·로그에 키를 넣지 않습니다.

| 환경변수 | 기본값 / 범위 | 용도 |
| --- | --- | --- |
| `BRAVE_SEARCH_API_KEY` | 비어 있음 | LIVE 인증 키 |
| `SEARCH_QUERIES_PER_CATEGORY` | 2 / 1–3 | 카테고리별 검색어 수 |
| `SEARCH_RESULTS_PER_QUERY` | 5 / 1–10 | 검색어별 결과 상한 |
| `SEARCH_CACHE_TTL_SECONDS` | 300 / 0–3600 | 프로세스 메모리 캐시 수명, 0은 비활성 |
| `SEARCH_MIN_INTERVAL_MS` | 1100 / 1000–10000 | LIVE 요청 시작 간 최소 간격 |

기본 7종 × 2개로 최대 14회 API 요청을 순차 처리합니다. 재시도 폭주를 피하기 위해 자동 재시도는 하지 않으며 인증·사용 한도 오류는 60초 동안 후속 요청을 억제합니다. 공급자 요청 제한 시간은 12초입니다. 카테고리별 실패는 다른 결과를 지우지 않습니다. 캐시는 최대 200개 쿼리이며 서버 재시작 시 사라집니다. 캐시 사용 시 최초 발견 시각을 유지합니다.

## 결과 해석과 한계

- **발견 ≠ 결론.** 스니펫은 검색 메타데이터이며 부족·수요·필요성을 입증한 문장이 아닙니다.
- 분류는 검색 목적에서 가져오는 임시 분류입니다. 도메인 선호는 검색 전략이며 신뢰성 평가가 아닙니다. 검색 제공자가 반환한 원문의 내용·법적 효력·진위를 이번 단계에서 검증하지 않습니다.
- 제공자의 사이트 표시명은 기관명으로 추정하지 않습니다. Brave가 기관명을 별도로 제공하지 않으면 `sourceOrganization = null`입니다.
- Brave의 `page_age`는 발행/수정 날짜가 혼재할 수 있어 `publishedDate = null`로 두고 `providerDateHint`로 보존합니다. 발견 시각과 발행일을 혼동하지 않습니다.
- URL 중복은 추적 파라미터·일반 문서 앵커 제거 및 파라미터 정렬로 판별합니다. 문서 식별 파라미터와 SPA 라우트는 보존하며 **원문 링크 자체는 제공자 값을 유지**합니다. 같은 URL의 검색 유형·검색어는 합칩니다. 전체 건수는 고유 자료 수이고 유형별 건수 합은 다를 수 있습니다.
- 지명 추출은 소규모 명시 지명 목록과 제목·스니펫의 문자 일치만 사용합니다. 목록 밖의 지역은 누락될 수 있으며 필요 지역·행정코드를 추론하지 않습니다. 원문의 지리 범위는 미확인으로 둡니다.
- 결과가 없으면 **“확인 가능한 근거를 찾지 못했습니다.”**를 표시합니다. 실패·빈 결과를 실제처럼 보이는 자료로 채우지 않습니다.

## 제공자 확장

1. `SearchProvider` 인터페이스(`frontend/services/evidence/types.ts`)의 ID, 모드, 지원 유형, 설정 여부와 `search(query, signal)`을 구현합니다.
2. 실제 API 응답에서 `RawSearchResult[]`를 매핑합니다. LIVE에는 실제 원문 URL을 넣고 확인할 수 없는 기관·날짜는 null로 둡니다.
3. `backend/evidence/api.ts`의 LIVE 오케스트레이터 제공자 배열에 등록하고, 비밀값은 서버 환경변수로 주입합니다. 제공자 ID는 고유해야 합니다.
4. 정규화된 `EvidenceItem[]` 계약을 유지합니다. React 컴포넌트는 제공자의 URL·인증 방식·응답 구조를 알 필요가 없습니다.

법령·학술·공공자료 전용 API는 이후 같은 인터페이스로 추가할 수 있습니다. 현재 이들 전용 API가 설치되어 있는 것은 아니며, 모든 LIVE 유형은 Brave 검색과 유형별 도메인 선호를 사용합니다.

## 검증

```sh
npm run build
npm test
```

기존 #3 서비스 테스트로 쿼리 제한, 미설정 키, DEMO 분리, 빈 결과, 일부 제공자 실패, URL 중복, 발행일 미상, 캐시·만료, 순차 실행·중단, API 어댑터 계약 및 키 비노출을 확인합니다. 예약된 `example.org` 응답은 테스트에만 사용합니다.

Chrome에서 미설정 상태·DEMO 결과·필터·건수·빈 결과·부분 실패·중단/재시작·모바일 화면을 확인했습니다. **현재 실제 키가 없으므로 Brave LIVE 왕복 호출은 검증하지 못했습니다.** 어댑터는 공식 응답 형식의 테스트 응답으로 검증했습니다. #4에서는 발견 메타데이터의 잠정 평가만 추가했고 지역 추천은 구현하지 않았습니다.


## #4 근거 강도 계산

기본값은 **평가 가능한 항목들의 동일 가중 평균**입니다. 날짜·출처·지역 등 필요한 정보가 없으면 해당 점수는 null로 남기고 평균에서 제외합니다. 실제 0점은 포함하며 가용 항목이 없으면 종합 점수도 null입니다. 점수 옆에 `평가 3 / 5항목` 같은 완성도를 표시하고, **평가 근거 보기** 안에 이유·관찰 신호·분자·분모를 공개합니다.

- 규칙 기반: 출처 식별/추적 메타데이터, 발행일과 자료 맥락, 명시 지명의 구체성, 제목·스니펫의 수량/조사/비교 표현
- 현재 미해결: 의미 관련성, 직접/맥락 구분, 수요 지지/약화 방향. 단어 일치만으로 점수나 결론을 만들지 않습니다.
- 모든 분석은 `metadata_only`입니다. 신뢰성도 원문 진위나 동료심사 검증 점수가 아닌 제한적인 대리 지표입니다.
- 점수·라벨·Top Evidence 기준과 교체 가능한 `EvidenceWeightConfig`는 `analysis/config.ts`에 모았습니다. 기본은 다섯 항목 모두 1이며 검증된 가중치·AHP가 아닙니다.
- Top Evidence는 일정 강도·완성도를 충족하는 최대 5개만 선택합니다. 유사한 품질에서 유형 다양성을 고려하되 약한 자료를 억지로 채우지 않습니다.
- 수요 감소·충분한 공급·유휴 시설 등 반대 방향의 자료도 보존합니다. `stance`는 현재 UNKNOWN이며 시설 건립을 지지한다고 가정하지 않습니다.

상세 규칙·임계값·결측값·한계: [EVIDENCE_EVALUATION](docs/EVIDENCE_EVALUATION.md).

#4에서 추가 의존성은 없습니다. 전체 26개 서비스 테스트와 Chrome의 DEMO 및 테스트 응답 기반 LIVE 카드 검증을 수행합니다. 현재 기본 미리보기는 **MOCK / DEMO**입니다. 의미 분석 LLM은 연결하지 않았습니다. #5의 지역 연결은 아래 규칙으로 수행하며 최종 부지 추천은 하지 않습니다.


## #5 지역 연결과 후보 점수

- 명시된 전체 지명과 안전한 등록 별칭을 정규화합니다. `광주`, `중구` 등은 모호함으로 보존하고 점수에서 제외합니다. 공식 행정코드·전국 시군구 전수 사전은 미연결입니다.
- 전국 자료는 **전국 공통 배경 근거**에 보존하며 모든 지역으로 배분하지 않습니다. 기관명·도메인·검색어로 지역을 추론하지 않습니다.
- Candidate Score는 상한 적용 후 근거 강도, 판정된 직접성, 출처 다양성, 자료 다양성, 지역 구체성의 **가용 축 동일 가중 평균**입니다. 점수는 추가 조사 우선도를 뜻하며 최적 부지가 아닙니다.
- 동일 기관·도메인 또는 동일 정규 제목의 자료는 묶어 1개만, 같은 주 탐색 유형은 최대 2개만 점수에 기여합니다. 원본 자료는 상세에 남습니다.
- 충분성 기준을 통과한 후보만 최대 50개 표시합니다. 정보 부족 지역은 점수를 보류하고 **추가 확인 지역**으로 표시합니다.
- Confidence는 대표 출처·유형 수, 평가 완성도, 정규화 확신도, 역할·수요 방향·최신성 판정 가능 비율로 HIGH/MEDIUM/LOW/INSUFFICIENT를 구분합니다. 강한 수요 약화 근거는 숨기거나 점수에서 일괄 차감하지 않고 확신도를 낮춥니다.
- 상세의 WHY 설명은 실제 자료 제목·지역 표기·인용·기존 평가만 사용하며 원문으로 연결됩니다. 필요성 지지·반대/주의·배경·미판정 자료를 구분합니다.

지도는 권역별 개략 배치이며 정밀 경계·좌표·GIS 분석이 아닙니다. 지도와 후보 목록은 같은 선택 상태를 사용합니다. 지역명 검색과 지역 상세 유형 필터를 제공하며, 유형 필터는 점수를 바꾸지 않습니다.

기본 **DEMO** 자료는 독립 출처·평가 정보가 부족해 후보가 0개일 수 있습니다. 가상의 출처를 추가해 순위를 채우지 않습니다. 지역 연결 결과는 추가 확인 영역에서 살펴볼 수 있습니다. 실제 LIVE 검색은 `BRAVE_SEARCH_API_KEY` 설정이 필요하고, 현재 환경에서는 키가 없어 실제 API 왕복은 미검증입니다.

새 의존성 없이 구현했습니다. 빌드와 기존/추가 서비스 검증(총 37개), Chrome의 DEMO 및 명시적인 시험 응답을 통한 지도·목록·상세/필터/원문 추적을 확인합니다.

상세 문서: [지역 정규화·한계](docs/GEOGRAPHIC_MAPPING.md), [후보 점수·Confidence](docs/CANDIDATE_SCORE.md). #6 문제 정의는 위 새 모델로 연결했습니다. 필지 선정·설계 생성은 구현하지 않습니다.

## 현재 검증

기존 37개와 현상·문제 정의 테스트를 통과했습니다. 어린이집·노인복지관·청소년 문화시설·도서관의 시험 근거에서 서로 다른 공간 질문을 확인합니다. Chrome에서는 DEMO 이슈 선택 전 지도 미표시, 선택 지역 연결, 5개 항목 편집·개별 재생성, 원문 이동, 모바일·모드 초기화를 확인합니다. 실제 LIVE 검색 대신 서비스 테스트의 명시적 TEST ONLY 근거로 강한 자료·상반 자료·전국 분리 경계를 검증합니다.

## 실제 시·도 경계 지도

수작업 개략 SVG를 제거하고 geoBoundaries / Natural Earth의 2021년 KOR ADM1 GeoJSON(17개 시·도)을 d3-geo로 투영합니다. 제주·도서를 원래 위치에 유지하며 hover·키보드·클릭 선택과 기존 지역 상세를 연결합니다. 경계 파일과 출처·Public Domain 고지는 [data/geography/README.md](data/geography/README.md)에 보존했습니다. 시·군·구 경계 드릴다운은 아직 구현하지 않았습니다.

## 지역 근거 엔진

[REGIONAL_EVIDENCE_ENGINE.md](docs/REGIONAL_EVIDENCE_ENGINE.md)에 행정 단위, 직접/상위/전국 맥락, 지표 비교, 파생지표, 데이터 부족, 점수 산식과 한계를 기록했습니다. 구현은 `frontend/services/regional/`, 화면은 `frontend/components/RegionalEvidence/`입니다. 기존 검색 API를 재사용하며 광역 발견 최대 6개 쿼리, 사용자가 선택한 최대 2개 시군구에 각 3개 검증 쿼리를 실행합니다.

단순 언급만으로 후보를 만들지 않습니다. 시·도/전국 자료는 하위 지역 직접 근거가 아니며 Issue Signal에 가산하지 않습니다. 명시적 시군구 + 선택 이슈 연결 + 최소 1건의 직접 검증 근거면 일부 확인 지역이 될 수 있습니다. 부족한 차원은 보존하고 confidence를 낮춥니다. TOP 50 요구는 제거했습니다. 실제 지도는 엔진 출력만 보여주며 지역을 생성하지 않습니다.

현재 DEMO와 기본 LIVE 검색 메타데이터에는 지역별 원문 검증 수치·정의·분모가 부족합니다. 구조화 통계 어댑터와 의미 평가 미연결 상태에서는 지표 비교/이슈 확정이 보류됩니다. 기존 정량 필드는 미검증 지표로 보존하고 수치를 채우지 않습니다.

## LIVE DATA #1 — KOSIS 총인구

서버 전용 `KOSIS_API_KEY`를 `.env.local`에 설정하고 재시작하면 LIVE SEARCH 모드의 공식 인구 데이터 패널에서 조회할 수 있습니다. Brave 검색 설정과 독립적입니다. `101 / DT_1B040A3`의 메타데이터 기반 총인구 정규화·캐시·원본 추적·지역 엔진 연결을 구현했습니다. 연령 인구/시설 공급은 미연결이며, 총인구만으로 건축 이슈나 순위를 생성하지 않습니다. 현재 키가 없어 실제 LIVE 요청은 미검증입니다. [설정·제약·검증](docs/LIVE_DATA_KOSIS.md).

## LIVE DATA #2·#3 — 시군구 대상인구 및 시설 공급

공식 행정코드에서 중복 없는 256개 시군구 분석 단위와 실제 2026-07-01 경계를 연결했습니다. `DT_1B04006`의 명시 연령 인구, 결측 보고, 비교 백분위, 원본 추적을 지원합니다. 어린이집은 공식 `cpmsapi030`의 운영상태·정원·현원을 같은 코드로 집계합니다. `KOSIS_API_KEY`와 승인된 `CHILDCARE_API_KEY`는 서버에만 설정합니다. 현재 키가 없어 실제 인구·시설 LIVE 검증은 완료하지 못했습니다. 경계/시점이 호환되지 않는 증감·비율은 N/A입니다. [시군구 인구 엔진](docs/SIGUNGU_TARGET_POPULATION.md), [공급 엔진](docs/LIVE_DATA_FACILITY_SUPPLY.md).


### LIVE DATA #3 보완 검증 (2026-09-21)

수요·공급 파생 지표는 동일 지표·단위·대상 인구 정의·인구 모집단·시설 정의·SIGUNGU 수준·기준일의 집단에서만 비교합니다. 2개 이상의 고유 지역에 중간 순위 백분위 `100 × (낮은 값 개수 + 동률 개수 / 2) / 집단 크기`를 적용합니다. DEMO, 비유한 값, 중복 지역은 비교에서 배제합니다. 상세 화면에서 원값·백분위·집단 크기·시점과 입력 호환성 사유를 확인할 수 있습니다. 시설 수 및 정원/1,000명 지도를 제공하며 자료가 없으면 N/A입니다.

공급 품질에는 정원·현원 누락 비율(활성 시설 분모), 기준일·운영 상태 확인 비율(고유 시설 분모)이 포함됩니다. 분모가 없으면 null입니다. 공급 집계는 시설 유형·제공자·데이터셋·활성 정의를 인자로 받으며, 첫 공식 제공자는 어린이집입니다. 검증된 관계는 기존 Phenomenon/PhenomenonRelationship 형식으로 연결하고 지역 상세에서 건축 질문 → 관계 → 현상 → 입력 지표 → 출처를 추적합니다. Issue Signal은 임의 가산하지 않습니다.

실제 인증키는 KOSIS·어린이집 모두 MISSING으로 확인했습니다. `LIVE VALIDATION BLOCKED — API KEY REQUIRED`. 현재 실제 시설 LIVE 지표 및 실제 사례는 없으며, 256개는 분석 가능한 행정구역 수이지 시설 데이터 확보 지역 수가 아닙니다.


## 2026-09-22 실제 KOSIS 연결 검증 완료

이전 API 키 미설정 기록은 과거 상태입니다. 현재 실제 응답 → 정규 시군구 → UI LIVE 표시를 검증했습니다. 최신 2026-08 자료는 256개 시군구에 연결됐으며, 전체 103개 테스트와 빌드가 통과했습니다. 상세 수신 범위·실제 값·한계는 [검증 보고서](docs/KOSIS_LIVE_CHECKPOINT.md)를 참조하세요. 과거 경계 동일성은 미검증이므로 증감 계산은 보류합니다.
# Free LIVE evidence providers

Evidence Explorer의 실데이터 탐색은 유료 검색 API를 요구하지 않습니다. 기존 `KOSIS_API_KEY`를 사용하는 KOSIS 통합검색은 통계 범주를, 인증키가 필요 없는 Crossref REST API는 연구 범주를 제공합니다. Brave 일반 웹 검색은 선택 사항이며 미설정이어도 LIVE 탐색을 막지 않습니다. 법령·정책, 공공 보고서, 설문, 기사는 연결된 전용 제공자가 없어 `NOT CONNECTED`로 표시됩니다. LIVE 결과에는 DEMO 자료를 채워 넣지 않습니다.
