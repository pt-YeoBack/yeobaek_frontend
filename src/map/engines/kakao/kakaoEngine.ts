// [지도] //추가 카카오api 넣어야함 (JavaScript 키 → .env.local 의 VITE_KAKAO_MAP_KEY)
// 카카오 어댑터: 우리 리모컨(MapHandle) 버튼을 카카오 말로 바꿔 줘요.
import { MAP_COLORS, MAP_KEYS } from '../../core/config';
import { addScript, loadOnce } from '../../core/loadScript';
import { createMarkerElement } from '../../core/markerElement';
import type { LatLng, MapEngine, MapHandle, MapInstance } from '../../core/types';

// 카카오 level 은 작을수록 확대, 구글 zoom 은 클수록 확대라서 뒤집어요 (zoom 17 ≒ level 3)
const toLevel = (zoom: number) => Math.min(14, Math.max(1, Math.round(20 - zoom)));
const toZoom = (level: number) => 20 - level;

function load(): Promise<void> {
  return loadOnce('kakao', async () => {
    // 카카오api 넣어야함: MAP_KEYS.kakao 가 비어 있으면 MapView 가 여기까지 오지 않아요
    const query = new URLSearchParams({ appkey: MAP_KEYS.kakao, libraries: 'services', autoload: 'false' });
    await addScript(`https://dapi.kakao.com/v2/maps/sdk.js?${query}`);
    await new Promise<void>((resolve) => (window as any).kakao.maps.load(() => resolve()));
  });
}

function create(container: HTMLElement, options: { center: LatLng; zoom: number }): MapInstance {
  const maps = (window as any).kakao.maps;
  const point = (p: LatLng) => new maps.LatLng(p.lat, p.lng);
  const map = new maps.Map(container, { center: point(options.center), level: toLevel(options.zoom) });

  let overlays: any[] = []; // 지금 찍혀 있는 핀
  let lines: any[] = []; // 지금 그려진 선
  const clicks = new Set<(event: any) => void>();

  const clearOverlays = () => {
    overlays.forEach((o) => o.setMap(null));
    overlays = [];
  };
  const clearLines = () => {
    lines.forEach((l) => l.setMap(null));
    lines = [];
  };

  const handle: MapHandle = {
    native: map,
    setCenter(center, zoom) {
      if (zoom !== undefined) map.setLevel(toLevel(zoom));
      map.setCenter(point(center));
    },
    getCenter() {
      const c = map.getCenter();
      return { lat: c.getLat(), lng: c.getLng() };
    },
    getZoom() {
      return toZoom(map.getLevel());
    },
    fitBounds(points, padding = 32) {
      if (!points.length) return;
      const first = points[0];
      // 한 점뿐이면 확대는 그대로 두고 이동만
      if (points.every((p) => p.lat === first.lat && p.lng === first.lng)) {
        map.setCenter(point(first));
        return;
      }
      const bounds = new maps.LatLngBounds();
      points.forEach((p) => bounds.extend(point(p)));
      map.setBounds(bounds, padding, padding, padding, padding);
    },
    setMarkers(markers) {
      clearOverlays();
      overlays = markers.map(
        (m) =>
          new maps.CustomOverlay({
            map,
            position: point(m.position),
            content: createMarkerElement(m, true),
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: m.selected ? 2 : 1,
            clickable: true, // 핀을 눌렀을 때 지도 클릭까지 같이 일어나지 않게
          }),
      );
    },
    setPolylines(next) {
      clearLines();
      lines = next.map(
        (l) =>
          new maps.Polyline({
            map,
            path: l.path.map(point),
            strokeWeight: 5,
            strokeColor: l.color ?? MAP_COLORS.line,
            strokeOpacity: 0.9,
            strokeStyle: l.dashed ? 'shortdash' : 'solid',
          }),
      );
    },
    onClick(listener) {
      const wrapped = (event: any) => listener({ lat: event.latLng.getLat(), lng: event.latLng.getLng() });
      maps.event.addListener(map, 'click', wrapped);
      clicks.add(wrapped);
      return () => {
        if (clicks.delete(wrapped)) maps.event.removeListener(map, 'click', wrapped);
      };
    },
    relayout() {
      const center = map.getCenter();
      map.relayout();
      map.setCenter(center);
    },
  };

  return {
    handle,
    destroy() {
      clearOverlays();
      clearLines();
      clicks.forEach((c) => maps.event.removeListener(map, 'click', c));
      clicks.clear();
    },
  };
}

export const kakaoEngine: MapEngine = { id: 'kakao', hasKey: () => Boolean(MAP_KEYS.kakao), load, create };
