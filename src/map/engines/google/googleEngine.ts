/**
 * 구글 지도 엔진 (해외) — 지도 표시 · 마커 · 선 · 클릭
 * 장소 검색은 팀원 B 가 search.ts 에 PlaceSearcher 로 구현한다.
 *
 * SDK: Maps JavaScript API (libraries: marker, places, geometry)
 * Map ID(VITE_GOOGLE_MAP_ID)가 있으면 AdvancedMarkerElement 로 공통 HTML 마커를 그리고,
 * 없으면 기본 Marker(라벨만)로 대신한다.
 */
import { DEFAULT_ZOOM, MAP_COLORS, MAP_CONFIG } from '../../core/config';
import { loadScript } from '../../core/loadScript';
import { createMarkerElement, markerColor } from '../../core/markerElement';
import type { LatLng, MapEngine, MapHandle, MapMarker, MapPolyline } from '../../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type GoogleNs = any;

declare global {
  interface Window {
    google?: GoogleNs;
    __yeobaekGoogleMapsReady?: () => void;
  }
}

let ready: Promise<void> | null = null;

function loadGoogle(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    window.__yeobaekGoogleMapsReady = () => resolve();
    const params = new URLSearchParams({
      key: MAP_CONFIG.googleApiKey,
      v: 'weekly',
      language: MAP_CONFIG.language,
      libraries: 'marker,places,geometry',
      loading: 'async',
      callback: '__yeobaekGoogleMapsReady',
    });
    loadScript(`https://maps.googleapis.com/maps/api/js?${params}`).catch((e) => {
      ready = null;
      reject(e);
    });
  });
  return ready;
}

function createHandle(container: HTMLElement, options: { center: LatLng; zoom: number }): MapHandle {
  const g = window.google;
  const useAdvanced = Boolean(MAP_CONFIG.googleMapId && g.maps.marker?.AdvancedMarkerElement);

  const map = new g.maps.Map(container, {
    center: options.center,
    zoom: options.zoom ?? DEFAULT_ZOOM,
    mapId: MAP_CONFIG.googleMapId || undefined,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });

  let markers: any[] = [];
  let lines: any[] = [];

  const clearMarkers = () => {
    markers.forEach((m) => (useAdvanced ? (m.map = null) : m.setMap(null)));
    markers = [];
  };
  const clearLines = () => {
    lines.forEach((l) => l.setMap(null));
    lines = [];
  };

  const addMarker = (m: MapMarker) => {
    if (useAdvanced) {
      return new g.maps.marker.AdvancedMarkerElement({
        map,
        position: m.position,
        content: createMarkerElement(m),
        title: m.title,
        zIndex: m.selected ? 10 : undefined,
      });
    }
    const marker = new g.maps.Marker({
      map,
      position: m.position,
      title: m.title,
      label: m.label ? { text: m.label, color: '#ffffff', fontWeight: '700' } : undefined,
      icon: {
        path: g.maps.SymbolPath.CIRCLE,
        scale: m.label ? 13 : 8,
        fillColor: markerColor(m.color),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: m.selected ? 4 : 2,
      },
      zIndex: m.selected ? 10 : undefined,
    });
    if (m.onClick) marker.addListener('click', m.onClick);
    return marker;
  };

  const addLine = (l: MapPolyline) => {
    const color = l.color ?? MAP_COLORS.brand;
    const width = l.width ?? 5;
    return new g.maps.Polyline({
      map,
      path: l.path,
      strokeColor: color,
      strokeWeight: width,
      strokeOpacity: l.dashed ? 0 : 0.85,
      // 점선: 선을 숨기고 짧은 선 기호를 반복
      icons: l.dashed
        ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, scale: width / 1.5 }, offset: '0', repeat: `${width * 4}px` }]
        : undefined,
    });
  };

  return {
    provider: 'google',
    native: map,
    setCenter(center, zoom) {
      map.setCenter(center);
      if (zoom !== undefined) map.setZoom(zoom);
    },
    getCenter() {
      const c = map.getCenter();
      return { lat: c.lat(), lng: c.lng() };
    },
    getZoom() {
      return map.getZoom() ?? DEFAULT_ZOOM;
    },
    fitBounds(points, paddingPx = 48) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setCenter(points[0]);
        return;
      }
      const bounds = new g.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, paddingPx);
    },
    setMarkers(next) {
      clearMarkers();
      markers = next.map(addMarker);
    },
    setPolylines(next) {
      clearLines();
      lines = next.map(addLine);
    },
    onClick(listener) {
      const handle = map.addListener('click', (e: any) => {
        if (e.latLng) listener({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      return () => handle.remove();
    },
    relayout() {
      // 구글 지도는 컨테이너 크기 변화를 스스로 따라간다
    },
    destroy() {
      clearMarkers();
      clearLines();
      g.maps.event.clearInstanceListeners(map);
      container.innerHTML = '';
    },
  };
}

export const googleEngine: MapEngine = {
  id: 'google',
  load: loadGoogle,
  createMap: createHandle,
};
