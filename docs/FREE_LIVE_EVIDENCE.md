# Free LIVE Evidence Search

Prototype v1은 기존 EvidenceSearchProvider 계약과 SearchOrchestrator를 그대로 사용합니다.

- `kosis-search`: KOSIS 공식 통합검색 `statisticsSearch.do`. 기존 서버 전용 `KOSIS_API_KEY`를 재사용하며 `STATISTICS` 범주만 제공합니다.
- `crossref`: Crossref 공개 REST API `api.crossref.org/works`. 가입이나 API 키 없이 `RESEARCH` 범주만 제공합니다.
- `brave-web`: 선택적인 일반 웹 검색. 미설정 상태가 다른 LIVE 제공자를 차단하지 않습니다.

각 결과는 실제 제목, 제공 기관/표시명, 공개된 발행일, 스니펫, 원문 URL, 검색 시각, provider와 LIVE mode를 보존합니다. KOSIS가 발행일을 제공하지 않으면 null로 유지합니다. Crossref 초록이 없으면 문서 유형·출판기관·DOI만 표시합니다.

법령·정책, 공공 보고서, 수요조사·설문, 기사는 Prototype v1에서 `NOT CONNECTED`입니다. 검색 실패나 미연결 범주를 DEMO 자료로 대체하지 않습니다.

2026-09-25 실제 `어린이집` 검증 결과: KOSIS 통계 Evidence 5건, Crossref 연구 Evidence 10건. Evidence Explorer 카드 15건, KOSIS 원문과 DOI 링크, LIVE 상태를 브라우저에서 확인했습니다.
