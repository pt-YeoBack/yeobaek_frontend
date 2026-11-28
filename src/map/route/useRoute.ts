// [지도] //추가 카카오api 넣어야함 · 티맵api 넣어야함
// 들를 곳 목록을 주면 서버(/api/routes)에서 동선을 받아 오는 훅
import { useEffect, useMemo, useState } from 'react';
import ajax from '../../utils/ajax';
import type { LatLng, RouteResult } from '../core/types';

export type RouteMode = 'car' | 'walk';

export function useRoute(stops: LatLng[], mode: RouteMode, country?: string) {
  const key = JSON.stringify({ stops: stops.map(({ lat, lng }) => ({ lat, lng })), mode, country });
  const request = useMemo(() => JSON.parse(key) as { stops: LatLng[] }, [key]);
  const [answer, setAnswer] = useState<{ key: string; route: RouteResult } | null>(null);

  useEffect(() => {
    if (request.stops.length < 2) return;
    let alive = true;
    ajax
      .post('/routes', request)
      .then(({ data }) => data as RouteResult)
      // 서버까지 실패하면 직선 + 점선
      .catch((): RouteResult => ({ path: request.stops, distanceMeters: 0, durationSeconds: null, approximate: true }))
      .then((route) => {
        if (alive) setAnswer({ key, route });
      });
    return () => {
      alive = false;
    };
  }, [key, request]);

  const enough = request.stops.length >= 2;
  const route = enough && answer?.key === key ? answer.route : null;
  return { route, loading: enough && !route };
}
