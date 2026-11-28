// [지도] //추가 카카오api 넣어야함
// 교통정리: 한국이면 카카오, 해외면 구글로 보내요.
import type { LatLng, MapProviderId } from './types';

/**
 * 나라 코드가 없을 때만 쓰는 대략적인 네모.
 * 백엔드 RouteService.inKorea 와 같은 규칙이라 한쪽을 고치면 다른 쪽도 고쳐야 해요.
 */
export function isInKorea({ lat, lng }: LatLng): boolean {
  const box = lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 132;
  const japan = lat < 35 && lng > 129; // 네모에 걸리는 대마도 · 후쿠오카 쪽
  return box && !japan;
}

/** 나라 코드 → 없으면 좌표 → 둘 다 없으면 카카오 */
export function resolveProvider(country?: string | null, at?: LatLng): MapProviderId {
  if (country) return country.toUpperCase() === 'KR' ? 'kakao' : 'google';
  return !at || isInKorea(at) ? 'kakao' : 'google';
}
