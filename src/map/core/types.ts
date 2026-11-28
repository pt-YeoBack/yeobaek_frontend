// [지도] //추가 카카오api 넣어야함
// 지도에서 쓰는 "서류 양식" 모음. 카카오든 구글이든 이 양식으로만 주고받아요.
// 비유: 나라마다 콘센트 모양이 달라도 어댑터만 끼우면 같은 플러그를 쓰는 것.
// interface = 어떤 칸이 있는지 적은 양식, ? = 비워도 되는 칸

/** 지도 회사 */
export type MapProviderId = 'kakao' | 'google';

/** 좌표 한 점: lat = 위도(남북), lng = 경도(동서) */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 장소 한 곳 (백엔드 PlaceDTO 와 칸 이름이 같아요) */
export interface Place extends LatLng {
  /** 우리 DB 번호 (저장한 뒤에만 있음) */
  id?: number;
  provider: MapProviderId;
  /** 지도 회사가 붙인 번호 (지도를 눌러 고르면 없음) */
  providerPlaceId?: string | null;
  name: string;
  address: string;
}

/** 핀 하나 */
export interface MapMarker {
  id: string;
  position: LatLng;
  /** 순서 번호. 없으면 점 */
  label?: string;
  title?: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** 선 하나 */
export interface MapPolyline {
  id: string;
  path: LatLng[];
  /** 점선 = 대략적인 동선 */
  dashed?: boolean;
  /** #rrggbb */
  color?: string;
}

/** 지도 리모컨. 두 회사 지도 모두 버튼 구성이 같아요 */
export interface MapHandle {
  /** zoom 은 구글 기준 0~21 */
  setCenter(center: LatLng, zoom?: number): void;
  getCenter(): LatLng;
  getZoom(): number;
  fitBounds(points: LatLng[], padding?: number): void;
  setMarkers(markers: MapMarker[]): void;
  setPolylines(lines: MapPolyline[]): void;
  /** 돌려받은 함수를 부르면 클릭 듣기를 멈춤 */
  onClick(listener: (at: LatLng) => void): () => void;
  relayout(): void;
  /** 원본 지도 객체. 꼭 필요할 때만 */
  readonly native: unknown;
}

/** 엔진이 만든 지도 한 장: 리모컨 + 치우기 */
export interface MapInstance {
  handle: MapHandle;
  destroy(): void;
}

/** 지도 회사별 어댑터가 지켜야 할 약속 */
export interface MapEngine {
  id: MapProviderId;
  hasKey(): boolean;
  load(): Promise<void>;
  create(container: HTMLElement, options: { center: LatLng; zoom: number }): MapInstance;
}

/** 장소 검색 (engines 의 search.ts 가 구현) */
export interface PlaceSearcher {
  search(query: string): Promise<Place[]>;
  reverseGeocode(at: LatLng): Promise<Place | null>;
}

/** 동선 (백엔드 RouteResultDTO 와 칸 이름이 같아요) */
export interface RouteResult {
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number | null;
  approximate: boolean;
}
