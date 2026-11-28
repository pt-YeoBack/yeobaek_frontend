// [지도] //추가 구글api 넣어야함 (브라우저 키 → .env.local 의 VITE_GOOGLE_MAPS_API_KEY)
// 구글 어댑터: 우리 리모컨(MapHandle) 버튼을 구글 말로 바꿔 줘요.
import { MAP_COLORS, MAP_KEYS } from '../../core/config';
import { addScript, loadOnce } from '../../core/loadScript';
import { createMarkerElement } from '../../core/markerElement';
import type { LatLng, MapEngine, MapHandle, MapInstance, MapMarker } from '../../core/types';

const CALLBACK = '__yeobackGoogleMapsReady'; // 구글이 준비되면 불러 주는 함수 이름
let libs: any = null; // 받아 온 구글 부품들

function load(): Promise<void> {
  return loadOnce('google', async () => {
    const ready = new Promise<void>((resolve) => ((window as any)[CALLBACK] = () => resolve()));
    // 구글api 넣어야함: MAP_KEYS.google 이 비어 있으면 MapView 가 여기까지 오지 않아요
    const query = new URLSearchParams({ key: MAP_KEYS.google, v: 'weekly', loading: 'async', callback: CALLBACK });
    await addScript(`https://maps.googleapis.com/maps/api/js?${query}`);
    await ready;

    const maps = (window as any).google.maps;
    const [core, map, marker] = await Promise.all([
      maps.importLibrary('core'),
      maps.importLibrary('maps'),
      maps.importLibrary('marker'),
    ]);
    libs = { core, map, marker };
  });
}

function create(container: HTMLElement, options: { center: LatLng; zoom: number }): MapInstance {
  const { core, map: mapLib, marker: markerLib } = libs;
  const mapId = MAP_KEYS.googleMapId;
  const map = new mapLib.Map(container, {
    center: options.center,
    zoom: options.zoom,
    ...(mapId ? { mapId } : {}),
    clickableIcons: false, // 가게 아이콘을 눌러도 "빈 곳 클릭" 으로 받기
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy', // 휴대폰에서 한 손가락으로 이동
  });

  let removeMarkers: (() => void)[] = [];
  let lines: any[] = [];
  const clicks = new Set<any>();

  const clearMarkers = () => {
    removeMarkers.forEach((remove) => remove());
    removeMarkers = [];
  };
  const clearLines = () => {
    lines.forEach((l) => l.setMap(null));
    lines = [];
  };

  // Map ID 가 있을 때: 카카오와 같은 HTML 핀
  const addHtmlMarker = (m: MapMarker) => {
    const pin = new markerLib.AdvancedMarkerElement({
      map,
      position: m.position,
      title: m.title ?? '',
      zIndex: m.selected ? 2 : 1,
      gmpClickable: Boolean(m.onClick),
    });
    pin.anchorTop = '-50%'; // 기본은 아래쪽 끝 기준. 동그란 핀이라 한가운데로
    pin.append(createMarkerElement(m, false));
    const click = () => m.onClick?.();
    if (m.onClick) pin.addEventListener('gmp-click', click);
    return () => {
      pin.removeEventListener('gmp-click', click);
      pin.map = null;
    };
  };

  // Map ID 가 없을 때: 구글 원형 기본 마커 (가이드 7쪽)
  const addCircleMarker = (m: MapMarker) => {
    const pin = new markerLib.Marker({
      map,
      position: m.position,
      title: m.title,
      zIndex: m.selected ? 2 : 1,
      clickable: Boolean(m.onClick),
      label: m.label ? { text: m.label, color: MAP_COLORS.text, fontSize: '12px', fontWeight: '700' } : undefined,
      icon: {
        path: core.SymbolPath.CIRCLE,
        scale: (m.label ? 14 : 10) + (m.selected ? 4 : 0),
        fillColor: m.color ?? MAP_COLORS.marker,
        fillOpacity: 1,
        strokeColor: MAP_COLORS.text,
        strokeWeight: 3,
      },
    });
    const listener = m.onClick ? pin.addListener('click', () => m.onClick?.()) : null;
    return () => {
      listener?.remove();
      pin.setMap(null);
    };
  };

  const handle: MapHandle = {
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
      return map.getZoom();
    },
    fitBounds(points, padding = 32) {
      if (!points.length) return;
      const first = points[0];
      // 한 점뿐이면 확대는 그대로 두고 이동만
      if (points.every((p) => p.lat === first.lat && p.lng === first.lng)) {
        map.setCenter(first);
        return;
      }
      const bounds = new core.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, padding);
    },
    setMarkers(markers) {
      clearMarkers();
      removeMarkers = markers.map(mapId ? addHtmlMarker : addCircleMarker);
    },
    setPolylines(next) {
      clearLines();
      lines = next.map((l) => {
        const color = l.color ?? MAP_COLORS.line;
        // 구글에는 점선 옵션이 없어서, 선은 숨기고 짧은 막대를 반복
        const dash = { icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' };
        return new mapLib.Polyline({
          map,
          path: l.path,
          clickable: false,
          strokeColor: color,
          strokeWeight: 5,
          strokeOpacity: l.dashed ? 0 : 0.9,
          icons: l.dashed ? [dash] : [],
        });
      });
    },
    onClick(listener) {
      const registered = map.addListener('click', (event: any) => {
        if (event.latLng) listener({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      clicks.add(registered);
      return () => {
        registered.remove();
        clicks.delete(registered);
      };
    },
    relayout() {
      // 구글은 크기 변화를 스스로 따라가서 할 일이 없어요
    },
  };

  return {
    handle,
    destroy() {
      clearMarkers();
      clearLines();
      clicks.forEach((c) => c.remove());
      clicks.clear();
    },
  };
}

export const googleEngine: MapEngine = { id: 'google', hasKey: () => Boolean(MAP_KEYS.google), load, create };
