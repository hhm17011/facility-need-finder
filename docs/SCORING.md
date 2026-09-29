# FUTURE / SECONDARY — 지역 점수 설계

현재 핵심 시스템은 근거 탐색과 종합입니다. 아래 내용은 #1의 보존용 초안이며 미래 보조 단계에서 재검토합니다. #2에서는 Need Score·가중치·AHP·지역 순위를 계산하지 않습니다. 아래 동일 가중치 초안은 근거 유형의 중요도나 개별 자료 평가에 적용되지 않습니다.

개별 근거는 향후 신뢰성·관련성·최신성·지역 특정성·구체성을 평가합니다. 법령·논문·기사 등 유형별 고정 점수는 부여하지 않습니다.

# Need Score

초기 MVP는 검증되지 않은 임의 가중치를 사용하지 않는다.

기본 평가축:
- Demand
- Supply Gap
- Change
- Context

초기 기본값:
- 각 평가축 동일 가중치

Pipeline:
Raw Data → Validation → Direction → Normalization 0–100
→ Category Score → Weighting → Need Score 0–100

향후 AHP 또는 사용자/전문가 기반 가중치 기능을 추가할 수 있도록 분리 설계한다.
