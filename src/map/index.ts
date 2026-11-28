/**
 * 지도 모듈 공개 창구 — 화면(pages/*)은 여기서만 import 한다.
 *
 *   import { MapView, type Place } from '../map';
 *
 * 구성 · 규칙 · 역할 분담은 src/map/README.md 참고
 */
export { MapView } from './core/MapView';
export type { MapViewProps } from './core/MapView';
export { resolveProvider, providerForCountry, isInKorea } from './core/region';
export { hasKey, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_COLORS } from './core/config';
export type {
  LatLng,
  MapHandle,
  MapMarker,
  MapPolyline,
  MapProviderId,
  Place,
  PlaceSearcher,
  RouteLeg,
  RouteMode,
  RouteResult,
} from './core/types';

// 기능 모듈이 생기면 여기에 추가
// export { RouteMap, useRoute } from './route';        // 팀원 A
// export { PlacePicker, PlaceSearchBox } from './place'; // 팀원 B
