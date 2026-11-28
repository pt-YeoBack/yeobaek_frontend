/**
 * 카카오 지도 엔진 (한국) — 지도 표시 · 마커 · 선 · 클릭
 * 장소 검색 · 주소 변환은 팀원 B 가 search.ts 에 PlaceSearcher 로 구현한다
 * (SDK 의 services 라이브러리를 이미 같이 불러 둔다: kakao.maps.services.Places / Geocoder).
 *
 * SDK: //dapi.kakao.com/v2/maps/sdk.js?appkey=JavaScript키&autoload=false&libraries=services
 * 카카오 지도는 한국만 그린다. zoom 은 구글 기준으로 받아 카카오 level(1~14, 작을수록 확대)로 바꾼다.
 */
import { DEFAULT_ZOOM, MAP_COLORS, MAP_CONFIG } from '../../core/config';
import { loadScript } from '../../core/loadScript';
import { createMarkerElement } from '../../core/markerElement';
import type { LatLng, MapEngine, MapHandle, MapMarker, MapPolyline } from '../../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type KakaoNs = any;

declare global {
  interface Window {
    kakao?: KakaoNs;
  }
}

/** 구글 zoom(클수록 확대) ↔ 카카오 level(작을수록 확대). 대략 zoom 17 ≈ level 3 */
export function zoomToKakaoLevel(zoom: number): number {
  return Math.min(14, Math.max(1, Math.round(20 - zoom)));
}
export function kakaoLevelToZoom(level: number): number {
  return 20 - level;
}

let ready: Promise<void> | null = null;

function loadKakao(): Promise<void> {
  if (window.kakao?.maps?.Map) return Promise.resolve();
  if (ready) return ready;
  const params = new URLSearchParams({ appkey: MAP_CONFIG.kakaoAppKey, autoload: 'false', libraries: 'services' });
  ready = loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?${params}`)
    .then(() => new Promise<void>((resolve) => window.kakao.maps.load(() => resolve())))
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

function createHandle(container: HTMLElement, options: { center: LatLng; zoom: number }): MapHandle {
  const k = window.kakao;
  const toKakao = (p: LatLng) => new k.maps.LatLng(p.lat, p.lng);

  const map = new k.maps.Map(container, {
    center: toKakao(options.center),
    level: zoomToKakaoLevel(options.zoom ?? DEFAULT_ZOOM),
  });
  map.addControl(new k.maps.ZoomControl(), k.maps.ControlPosition.RIGHT);

  let overlays: any[] = [];
  let lines: any[] = [];

  const clearOverlays = () => {
    overlays.forEach((o) => o.setMap(null));
    overlays = [];
  };
  const clearLines = () => {
    lines.forEach((l) => l.setMap(null));
    lines = [];
  };

  // 공통 HTML 마커를 CustomOverlay 로 올린다 (구글과 같은 모양)
  const addMarker = (m: MapMarker) =>
    new k.maps.CustomOverlay({
      map,
      position: toKakao(m.position),
      content: createMarkerElement(m),
      xAnchor: 0.5,
      yAnchor: 0.5,
      clickable: Boolean(m.onClick),
      zIndex: m.selected ? 10 : 1,
    });

  const addLine = (l: MapPolyline) =>
    new k.maps.Polyline({
      map,
      path: l.path.map(toKakao),
      strokeColor: l.color ?? MAP_COLORS.brand,
      strokeWeight: l.width ?? 5,
      strokeOpacity: 0.85,
      strokeStyle: l.dashed ? 'shortdash' : 'solid',
    });

  return {
    provider: 'kakao',
    native: map,
    setCenter(center, zoom) {
      map.setCenter(toKakao(center));
      if (zoom !== undefined) map.setLevel(zoomToKakaoLevel(zoom));
    },
    getCenter() {
      const c = map.getCenter();
      return { lat: c.getLat(), lng: c.getLng() };
    },
    getZoom() {
      return kakaoLevelToZoom(map.getLevel());
    },
    fitBounds(points, paddingPx = 48) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setCenter(toKakao(points[0]));
        return;
      }
      const bounds = new k.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(toKakao(p)));
      map.setBounds(bounds, paddingPx, paddingPx, paddingPx, paddingPx);
    },
    setMarkers(next) {
      clearOverlays();
      overlays = next.map(addMarker);
    },
    setPolylines(next) {
      clearLines();
      lines = next.map(addLine);
    },
    onClick(listener) {
      const handler = (e: any) => listener({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
      k.maps.event.addListener(map, 'click', handler);
      return () => k.maps.event.removeListener(map, 'click', handler);
    },
    relayout() {
      // 카카오 지도는 컨테이너 크기가 바뀌면 직접 다시 그려야 한다
      const center = map.getCenter();
      map.relayout();
      map.setCenter(center);
    },
    destroy() {
      clearOverlays();
      clearLines();
      container.innerHTML = '';
    },
  };
}

export const kakaoEngine: MapEngine = {
  id: 'kakao',
  load: loadKakao,
  createMap: createHandle,
};
