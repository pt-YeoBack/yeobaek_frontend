// [지도] //추가 카카오api 넣어야함 · 티맵api 넣어야함
// 들를 곳 → 번호 마커 + 경로 선
import { CSSProperties, useMemo } from 'react';
import { MapView } from '../core/MapView';
import type { MapMarker, MapPolyline } from '../core/types';
import { RouteMode, useRoute } from './useRoute';

interface Props {
  stops: { name: string; lat: number; lng: number }[];
  mode: RouteMode;
  /** 'KR' → 카카오, 그 외 → 구글 */
  country?: string;
  style?: CSSProperties;
}

export function RouteMap({ stops, mode, country, style }: Props) {
  const { route, loading } = useRoute(stops, mode, country);

  const markers = useMemo<MapMarker[]>(
    () =>
      stops.map((s, i) => ({
        id: String(i),
        position: { lat: s.lat, lng: s.lng },
        label: String(i + 1), // 순서 번호
        title: s.name,
      })),
    [stops],
  );
  const lines = useMemo<MapPolyline[]>(
    () => (route ? [{ id: 'route', path: route.path, dashed: route.approximate }] : []),
    [route],
  );

  return (
    <div>
      <MapView country={country} center={stops[0]} markers={markers} polylines={lines} fitToContent style={style} />
      {loading && <p role="status">동선을 찾고 있어요…</p>}
      {route?.approximate && <p role="status">대략적인 동선이에요. 실제 길과 다를 수 있어요.</p>}
    </div>
  );
}
