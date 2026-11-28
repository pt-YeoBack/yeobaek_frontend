/**
 * 지도 모듈 공통 타입
 * ------------------------------------------------------------
 * 화면과 기능 모듈(route · place)은 이 타입으로만 주고받는다.
 * google.maps.* · kakao.maps.* 객체는 engines/ 안에서만 쓴다.
 */

/** 지도 공급자: 한국 = kakao, 해외 = google (core/region.ts 가 고른다) */
export type MapProviderId = 'google' | 'kakao';

/** 위도 · 경도 (WGS84) */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 장소 — 백엔드 tbl_place 와 같은 모양
 * 같은 장소라도 공급자마다 id 가 다르므로 provider + providerPlaceId 로 구분한다.
 */
export interface Place extends LatLng {
  /** 백엔드에 저장된 뒤 생기는 tbl_place.id */
  id?: number;
  provider?: MapProviderId;
  /** 구글 place_id 또는 카카오 장소 id */
  providerPlaceId?: string;
  name: string;
  address: string;
}

/** 지도 위 마커 (모든 엔진에서 같은 모양으로 그린다) */
export interface MapMarker {
  /** 같은 목록 안에서 고유한 값 */
  id: string;
  position: LatLng;
  /** 마커 안 글자 (동선 순서 번호 '1', '2' 등). 없으면 점 모양 */
  label?: string;
  /** 마우스를 올렸을 때 · 스크린리더용 이름 */
  title?: string;
  /** 'brand'(기본) · 'accent' · 'muted' 또는 #rrggbb */
  color?: 'brand' | 'accent' | 'muted' | string;
  selected?: boolean;
  onClick?: () => void;
}

/** 지도 위 선 (동선 경로 등) */
export interface MapPolyline {
  id: string;
  path: LatLng[];
  /** #rrggbb, 기본은 브랜드 색 */
  color?: string;
  /** 선 굵기 px, 기본 5 */
  width?: number;
  /** 점선: 실제 경로를 못 받아 직선으로 이은 '대략적인 동선' 등 */
  dashed?: boolean;
}

/**
 * 만들어진 지도 하나를 조작하는 손잡이. MapView 의 onReady 로 받는다.
 * zoom 은 구글 기준(0 = 세계, 21 = 건물). 카카오 엔진은 자기 level 로 바꿔서 쓴다.
 */
export interface MapHandle {
  readonly provider: MapProviderId;
  setCenter(center: LatLng, zoom?: number): void;
  getCenter(): LatLng;
  getZoom(): number;
  /** 주어진 지점이 모두 보이도록 화면 맞추기 (지점이 1개면 그 지점으로 이동) */
  fitBounds(points: LatLng[], paddingPx?: number): void;
  /** 마커 전체를 이 목록으로 바꾼다 */
  setMarkers(markers: MapMarker[]): void;
  /** 선 전체를 이 목록으로 바꾼다 */
  setPolylines(lines: MapPolyline[]): void;
  /** 지도 빈 곳 클릭. 해제 함수를 돌려준다 */
  onClick(listener: (at: LatLng) => void): () => void;
  /** 지도 영역 크기가 바뀌었을 때 다시 그리기 */
  relayout(): void;
  destroy(): void;
  /**
   * 공급자 원본 지도 객체 (google.maps.Map · kakao.maps.Map).
   * core 에 없는 기능이 꼭 필요할 때만 쓰고, 쓰게 되면 core 에 추가할지 함께 논의한다.
   */
  readonly native: unknown;
}

/** 공급자별 엔진: SDK 를 불러오고 지도를 만든다 */
export interface MapEngine {
  readonly id: MapProviderId;
  /** SDK 스크립트 로드 (여러 번 불러도 한 번만 로드) */
  load(): Promise<void>;
  createMap(container: HTMLElement, options: { center: LatLng; zoom: number }): MapHandle;
}

// ---------------------------------------------------------------------------
// 아래는 기능 모듈이 구현할 자리 (core 에서는 타입만 정한다)
// ---------------------------------------------------------------------------

/** 팀원 B — 장소 검색 · 주소 변환 (engines/{google,kakao}/search.ts 에 구현) */
export interface PlaceSearcher {
  readonly provider: MapProviderId;
  /** 장소 이름 · 주소로 검색 (near 가 있으면 그 주변 우선) */
  search(query: string, near?: LatLng): Promise<Place[]>;
  /** 좌표 → 주소 (지도를 눌러 위치를 고를 때) */
  reverseGeocode(at: LatLng): Promise<Place | null>;
}

/** 팀원 A — 동선 (백엔드 POST /api/routes 가 공급자를 골라 계산) */
export type RouteMode = 'car' | 'walk' | 'transit';

export interface RouteLeg {
  from: number; // stops 인덱스
  to: number;
  distanceM: number;
  durationSec: number;
  path: LatLng[];
}

export interface RouteResult {
  /** 전체 경로 좌표 (지도에 MapPolyline 으로 그린다) */
  path: LatLng[];
  distanceM: number;
  durationSec: number;
  legs: RouteLeg[];
  /** 실제 경로를 못 받아 직선으로 이었으면 true → 점선 + "대략적인 동선" 표시 */
  approximate: boolean;
}
