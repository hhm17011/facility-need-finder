# KOSIS real connection checkpoint — 2026-09-22

## Result: SUCCESS

A real authenticated KOSIS response was received, normalized to canonical SIGUNGU RegionalMetric objects, and displayed through the existing browser UI with LIVE status. No DEMO data was used. Browser checks covered Giheung-gu, Jongno-gu and Gangnam-gu; no browser runtime errors were observed.

## Verified API and actual-response corrections

Official specification: https://kosis.kr/openapi/devGuide/devGuide_0201List.do

- Metadata: `https://kosis.kr/openapi/statisticsData.do?method=getMeta` (`TBL`, `ORG`, `PRD`, `ITM`, `UNIT`).
- Statistics: `https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList`.
- Authentication: server-only `apiKey` from `KOSIS_API_KEY`; never included in the browser request or source links.
- Parameters: metadata-resolved `orgId`, `tblId`, `itmId`, `objL1`, `objL2`, `prdSe`, `startPrdDe`, `endPrdDe`; `format=json`, `jsonVD=Y`.
- Actual PRD metadata uses heading rows (`월`, `년`) and separate dotted dates. The provider normalizes these while retaining raw metadata.
- This table's standalone UNIT request returned official error 30; unit `명` is explicitly supplied in ITEM metadata. Only that specific absence uses item metadata; authentication failures do not fall back.
- Data and metadata table titles differ by a comma in DT_1B040A3. Validation ignores whitespace/commas, while preserving original titles.
- KOSIS district parent links can point directly to a province. Matching uses the explicit province context and unique canonical leaf name, without guessing code namespaces. Sejong SIDO and SIGUNGU records remain separate.

## Tables and observations

- `101 / DT_1B040A3`: 행정구역(시군구)별, 성별 인구수; item T20. 590 rows for 202607 and 202608. Giheung: 434,408 and 434,133 persons respectively.
- `101 / DT_1B04006`: 행정구역(시군구)별/1세별 주민등록인구; item T2 (총인구수). Latest monthly period 202608; selected earlier same-month period 202108.
- Age selections are resolved from metadata, not consecutive-code assumptions. For ages 0–5 the actual codes are 0401, 0402, 0403, 0404, 0405, 0501; total age code 000.

| Period | Raw cells | Raw regions | Canonical leaf SIGUNGU | Unresolved | Ambiguous | Other administrative units excluded |
|---|---:|---:|---:|---:|---:|---:|
| 202108 | 2058 | 294 | 217 | 32 | 0 | 45 |
| 202608 | 2079 | 297 | 256 | 1 | 0 | 40 |

Total selected age cells: 4,137. Counts are per period, not sums of unique regions across time. The one latest unresolved record is the parent aggregate `경상남도 창원시(통합)`; it is not silently assigned to one of its districts. Historical names/boundaries that do not match the current registry remain unresolved. National, SIDO, aggregate cities and branch offices are not direct leaf SIGUNGU inputs.

## Real example and source trace

- Region: 경기도 용인시 기흥구
- Canonical ID: sigungu:41463; canonical code 41463; provider classification C1=41463 stored separately.
- 2026-08 total population: **434,133 명** (both verified tables agree).
- 2026-08 target population, ages 0–5: **13,748 명**, sum of six actual age cells.
- Provider KOSIS; organization 101 (returned name 국가데이터처); table DT_1B04006; item T2.
- Retrieved: 2026-09-22T14:55:15.169Z.
- Official source: https://kosis.kr/statisticsList/mass/mass_list.jsp?org_id=101&process=statHtml&tbl_id=DT_1B04006
- Region Detail exposes provider, organization ID, table name/ID, item, provider geography, classification, reference period, retrievedAt, raw records and formula input IDs.

## UI validation and limitations

Open http://127.0.0.1:5173/ → enter 어린이집 → 분석하기 → LIVE SEARCH → 시군구 대상인구 조회 → search 기흥구 → select 경기도 용인시 기흥구 → expand the total/target metric in Region Detail. KOSIS does not require the separate Brave search key.

The target engine remains generic; no region values were hardcoded into application code. Real recorded fixtures live only under tests/fixtures and are never imported by application runtime.

Population, target population and same-period share are LIVE. Although historical observations were fetched, boundary equivalence has not been established, so change and change rate remain unavailable. Facility supply has not been extended in this checkpoint.

## Verification and security

- npm test: 103 passed, 0 failed/skipped.
- npm run build: typecheck and production build passed; non-blocking large-bundle warning remains.
- Separate live integration: `node scripts/check-kosis-live.mjs` while the dev server is running. Unit tests require no live credentials or network.
- Browser: three actual regions displayed; Giheung values checked against the same real response; source detail opened.
- .env/.env.local are ignored; key is server-only. Build output, source, documentation and fixtures were checked for the actual key value, with no matches. No key appears in this report or screenshot.
