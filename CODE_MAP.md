# 코드 지도

앱은 GitHub Pages에서 `index.html`을 직접 실행합니다. 아래 표식으로 필요한 부분만 읽으세요. 표식은 코드 위치를 안내하며, 파일 경로·실행 방식·데이터 저장 형식은 바꾸지 않습니다.

## 필요한 부분 읽기

```sh
python tools/read-section.py --list
python tools/read-section.py report-ui
python tools/read-section.py report-stats release
rg -n 'cumulativeReturnRate|reportStats' index.html
```

각 영역은 `@section <id>`부터 다음 표식 직전까지입니다. 줄 번호는 도구가 현재 파일에서 계산합니다. 중간 영역을 읽을 때 괄호가 완결되지 않을 수 있으며, 독립 실행용 모듈은 아닙니다.

| 표식 ID | 담당 기능 |
|---|---|
| `release` | 버전·수익률·공통 도구 |
| `presets` | 자산 분류·기본 계좌 |
| `state-validation` | 저장 데이터 검증·원금 마감 |
| `asset-math` | 자산 평가·위험자산·리밸런싱 날짜 |
| `order-plan` | 매수·매도·수수료 계획 |
| `tip` | 공통 도움말 |
| `aggregation` | 종목코드별 계좌 합산 |
| `quote-status` | 가격 갱신 상태 |
| `history-chart` | 자산 추이 계산·차트 |
| `charts` | 비중 차트·수익 배지 |
| `selectors` | 목표비중·자산 선택 컴포넌트 |
| `history-storage` | IndexedDB 이력 저장·날짜 키 |
| `app-state` | App 상태·기본 계좌·초기화·저장 효과 |
| `account-stats` | 계좌 평가액·납입원금·손익 계산 |
| `report-stats` | 통합 평가액·수익률·세액공제 계산 |
| `history-snapshot` | 오늘 자산 이력 기록 |
| `sorting` | 주문계획 연결·종목 정렬·드래그 |
| `asset-edit` | 자산·납입내역 편집 |
| `price-fetch` | 가격 조회·동시성·갱신 |
| `backup-restore` | JSON 백업·복원·연도마감 |
| `app-shell` | 복구 화면·탭·공통 화면 구성 |
| `report-ui` | 통합 리포트 화면 |
| `dashboard-ui` | 계좌 대시보드·리밸런싱 요약 |
| `assets-ui` | 자산 입력 화면 |
| `contributions-ui` | 납입 입력 화면 |
| `settings-ui` | 설정·버전·변경사항 화면 |
| `navigation-ui` | 하단 탭 |
| `rebalance-modal` | 리밸런싱 주문 상세 |
| `bootstrap` | React 앱 실행 |

## 수정별로 같이 볼 영역

| 변경 요청 | 우선 읽을 영역 | 필요할 때 함께 확인 |
|---|---|---|
| 통합 수익률 표시 | report-ui, report-stats, release | account-stats, asset-math |
| 리밸런싱 날짜 | asset-math, dashboard-ui | app-state, settings-ui |
| 주문 수량·현금·수수료 | order-plan | asset-math, sorting, rebalance-modal |
| 그래프·자산 이력 | history-chart | history-storage, history-snapshot |
| 가격 조회·갱신 상태 | price-fetch, quote-status | asset-edit, assets-ui |
| 백업·복원 | backup-restore, state-validation | app-state, history-storage |
| 납입 원금·배당 합산 | account-stats | state-validation, contributions-ui, report-stats |
| 버전·변경사항 | release, settings-ui | report-ui |

전체 함수/효과 의존성이 필요한 경우 표식 밖의 참조를 `rg`로 검색하세요. 파일을 옮겨 실제 모듈로 분리하려면 브라우저 Babel·CDN import·React hooks·PWA 캐시와 배포 경로를 함께 검증해야 합니다.
