# 지도 모듈 (src/map)

한국은 카카오, 해외는 구글. 화면은 `src/map/index.ts` 에서만 가져다 써요.

> 지금은 API 키가 없어서 **이 폴더의 코드가 전부 주석**이에요.
> 카카오api 넣어야함 · 티맵api 넣어야함 · 구글api 넣어야함

| 폴더 | 비유 | 하는 일 |
|---|---|---|
| `index.ts` | 정문 | 밖으로 내보내는 것 모음 |
| `core/types.ts` | 서류 양식 | 공통 타입 |
| `core/config.ts` | 설정판 | 키 · 기본 중심 · 색 |
| `core/region.ts` | 교통정리 | KR → 카카오, 그 외 → 구글 |
| `core/engines.ts` | 어댑터 보관함 | 이름으로 엔진 꺼내기 |
| `core/loadScript.ts` | 배달 담당 | SDK 한 번만 받기 |
| `core/markerElement.ts` | 핀 도장 | 같은 모양의 핀 |
| `core/MapView.tsx` | 액자 | 지도 부품 |
| `engines/kakao` | 카카오 어댑터 | 지도 · 검색 |
| `engines/google` | 구글 어댑터 | 지도 · 검색 |
| `place/` | 주소록 창구 | 장소 검색 · 선택 · 저장 |
| `route/` | 길 안내 창구 | 동선 |

규칙
1. `route/` 와 `place/` 는 `core/` 만 import 하고 서로 import 하지 않기
2. `core/` 는 `route/`, `place/` 를 모르기
3. 화면은 `index.ts` 에서만 import
4. `kakao.maps.*`, `google.maps.*` 는 `engines/` 안에서만
5. `core/` 를 바꾸면 함께 리뷰하고, 기능은 두 엔진 모두에 구현
6. `markers`, `polylines` 는 반드시 `useMemo`
7. `region.ts` 의 한국 판별을 바꾸면 백엔드 `RouteService.inKorea` 도 같이
