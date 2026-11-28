# 지도 모듈 (`src/map`)

여백의 모든 지도 화면이 함께 쓰는 모듈입니다. **한국은 카카오 지도, 해외는 구글 지도**를 쓰고,
화면과 기능 코드는 어느 공급자인지 몰라도 되도록 `core`가 감춰 줍니다.

- **core (완성)**: 공통 타입, 공급자 고르기, SDK 로딩, 지도 표시(`MapView`), 공통 마커와 선
- **route (팀원 A)**: 여행 동선 표시
- **place (팀원 B)**: 장소 검색, 위치 선택, 저장

## 1. 시작하기

1. `yeoback_front/.env.example`을 복사해 `.env.local`을 만들고 키를 채웁니다.
   `.env.local`은 git에 올라가지 않습니다.
2. `npm run dev`를 다시 시작합니다.
3. 키가 없으면 지도 자리에 "지도 키가 설정되지 않았어요"가 보입니다. 다른 화면 작업은 그대로 할 수 있습니다.

| 키 | 용도 | 발급 위치 |
| --- | --- | --- |
| `VITE_KAKAO_MAP_KEY` | 한국 지도 | Kakao Developers의 같은 앱 **JavaScript 키**. 플랫폼 > Web에 `http://localhost:5173` 등록 |
| `VITE_GOOGLE_MAPS_API_KEY` | 해외 지도 | Google Cloud Console. **웹사이트 제한**에 `http://localhost:5173/*` 등록 |
| `VITE_GOOGLE_MAP_ID` | 구글 최신 마커 (선택) | Google Cloud Console > 지도 관리 |

## 2. 구조

```
src/map/
├─ index.ts                 공개 창구 — 화면은 여기서만 import
├─ core/                    공통 (변경은 두 팀원이 함께 리뷰)
│  ├─ types.ts              Place · LatLng · MapMarker · MapPolyline · MapHandle · MapEngine
│  │                        + 기능 모듈용 PlaceSearcher(팀원 B) · RouteResult(팀원 A)
│  ├─ config.ts             키 · 기본 중심 · 색
│  ├─ region.ts             공급자 고르기 (KR → kakao, 그 외 → google)
│  ├─ engines.ts            공급자 id → 엔진 (core 가 engines 를 아는 유일한 곳)
│  ├─ loadScript.ts         SDK 스크립트 한 번만 로드
│  ├─ markerElement.ts      공통 마커 HTML (두 지도에서 같은 모양)
│  └─ MapView.tsx           지도 하나를 그리는 컴포넌트
├─ engines/
│  ├─ google/googleEngine.ts   구글: 지도 · 마커 · 선 · 클릭
│  └─ kakao/kakaoEngine.ts     카카오: 지도 · 마커 · 선 · 클릭 (zoom ↔ level 변환)
├─ route/                   (팀원 A가 만듦)
└─ place/                   (팀원 B가 만듦)
```

### 지켜야 할 규칙

1. `route/`와 `place/`는 `core/`만 import합니다. **서로를 import하지 않습니다.**
2. `core/`는 `route/`와 `place/`를 모릅니다.
3. 화면(`pages/*`)은 `src/map/index.ts`에서만 가져다 씁니다.
4. `google.maps.*`와 `kakao.maps.*`는 `engines/` 안에서만 씁니다. 밖으로는 항상 `Place`, `LatLng`, `MapMarker`, `MapPolyline`을 주고받습니다.
5. `core/`에 기능을 추가해야 하면 두 사람이 함께 정하고, 두 엔진 모두에 구현합니다.

## 3. `MapView` 사용법

```tsx
import { MapView, type MapMarker } from '../map';

const markers: MapMarker[] = places.map((p, i) => ({
  id: String(p.id ?? i),
  position: { lat: p.lat, lng: p.lng },
  label: String(i + 1),          // 동선 순서 번호 (없으면 점)
  title: p.name,
  onClick: () => select(p),
}));

<MapView
  country={trip.countryCode}     // 'KR' → 카카오, 그 외 → 구글
  markers={markers}
  polylines={[{ id: 'route', path: route.path, dashed: route.approximate }]}
  fitToContent                   // 마커 · 선이 모두 보이게 자동 맞춤
  onMapClick={(at) => pickAt(at)} // 빈 곳 클릭 (위치 고르기)
  onReady={(map) => (mapRef.current = map)} // 직접 이동 · 맞추기
  style={{ height: 280 }}
/>
```

| props | 설명 |
| --- | --- |
| `country` / `provider` | 공급자 고르기. 나라 코드(`KR`이면 카카오) 또는 직접 지정 |
| `center`, `zoom` | 중심과 확대. `zoom`은 **구글 기준**(0~21, 클수록 확대). 카카오는 자동으로 level로 바꿈 |
| `markers` | 마커 목록 (선언형, 바뀌면 다시 그림) |
| `polylines` | 선 목록. `dashed`는 점선 (대략적인 동선) |
| `fitToContent` | 마커와 선이 바뀔 때마다 전부 보이게 맞춤 |
| `onMapClick` | 지도 빈 곳 클릭 좌표 |
| `onReady` | `MapHandle`(이동 `setCenter`, 맞추기 `fitBounds`, 원본 `native`) |
| `children` | 지도 위에 겹쳐 올릴 요소 (검색창, 버튼 등) |

**주의:** `markers`나 `polylines` 배열을 매 렌더마다 새로 만들면 매번 다시 그립니다. `useMemo`로 만들어 주세요.

## 4. 팀원별 할 일

### 팀원 A — 동선 (`route/`)

- `RouteMap`(경유지 → 번호 마커와 경로 선)과 `useRoute(stops, mode)`를 만듭니다.
- 경로 계산은 **백엔드 `POST /api/routes`** 가 공급자를 고릅니다.
  - 해외: Google Routes API
  - 한국 자동차: 카카오모빌리티
  - 한국 도보: TMAP
  - 실패하거나 지원하지 않으면 직선으로 잇고 `approximate: true`
- 응답은 `core/types.ts`의 `RouteResult` 모양으로 받습니다.
- `approximate`가 `true`이면 `dashed` 선과 "대략적인 동선" 안내를 보여 줍니다.

### 팀원 B — 장소 검색 · 선택 · 저장 (`place/`)

- `engines/google/search.ts`와 `engines/kakao/search.ts`에 `PlaceSearcher`(`search`, `reverseGeocode`)를 구현합니다.
  - 카카오: SDK `services` 라이브러리가 이미 함께 로드됩니다 (`kakao.maps.services.Places`, `Geocoder`).
  - 구글: Places API (New), Geocoding API. 구글 콘솔에서 사용 설정이 필요합니다.
- `PlaceSearchBox`와 `PlacePicker`(검색하거나 지도를 눌러 고르기 → `onSelect(place)`)를 만듭니다.
- 고른 장소는 **백엔드 `POST /api/places`** 로 `tbl_place`에 저장합니다.
  - 같은 `provider + providerPlaceId`가 있으면 기존 id를 돌려주게 합니다.
  - `tbl_place`의 `google_place_id`는 `place_provider` + `provider_place_id`로 바꿔야 합니다.

## 5. 알아 둘 점

- **카카오 지도는 한국만** 그립니다. 해외 좌표에 `provider="kakao"`를 쓰면 빈 지도가 됩니다.
- **구글은 한국에서 자동차·도보 길찾기를 지원하지 않습니다.** 그래서 한국 경로는 카카오모빌리티와 TMAP을 씁니다.
- 공급자마다 데이터 사용 약관이 있으니, **한 지역의 지도·검색은 같은 공급자**로 맞춥니다. 한국 경로처럼 다른 공급자의 결과를 그려야 하면 약관을 먼저 확인합니다.
- 구글 지도는 사용량에 따라 요금이 나옵니다. 개발 중에는 콘솔에서 일일 사용량 상한을 걸어 두세요.
