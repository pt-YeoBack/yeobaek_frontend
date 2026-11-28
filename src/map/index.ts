// [지도] //추가 카카오api 넣어야함
// 지도 모듈 정문: 화면(pages/*)은 이 파일에서만 import 해요.
// 비유: 건물 안 어느 방에 있든 손님은 안내 데스크 하나만 찾아오면 되는 것.

// core
export { MapView, type MapViewProps } from './core/MapView';
export { isInKorea, resolveProvider } from './core/region';
export type {
  LatLng,
  MapHandle,
  MapMarker,
  MapPolyline,
  MapProviderId,
  Place,
  PlaceSearcher,
  RouteResult,
} from './core/types';

// 기능 (장소 · 동선)
export * from './features';
