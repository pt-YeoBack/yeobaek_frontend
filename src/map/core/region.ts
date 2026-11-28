import type { LatLng, MapProviderId } from './types';

/**
 * 어느 지도 공급자를 쓸지 고른다.
 *  1. 나라 코드가 있으면: KR → kakao, 그 외 → google
 *  2. 나라 코드가 없으면 좌표가 한국 범위 안인지로 판단
 *  3. 둘 다 없으면 kakao (국내 서비스 기본)
 * 카카오 지도는 한국만 그리므로 해외 좌표에 kakao 를 쓰면 빈 지도가 된다.
 */

// 제주 · 울릉도 · 독도까지 포함하는 대략적인 범위
const KOREA_BOUNDS = { south: 33.0, north: 38.7, west: 124.5, east: 132.0 };

export function isInKorea(at: LatLng): boolean {
  return (
    at.lat >= KOREA_BOUNDS.south &&
    at.lat <= KOREA_BOUNDS.north &&
    at.lng >= KOREA_BOUNDS.west &&
    at.lng <= KOREA_BOUNDS.east
  );
}

export function providerForCountry(countryCode: string): MapProviderId {
  return countryCode.trim().toUpperCase() === 'KR' ? 'kakao' : 'google';
}

export function resolveProvider(hint: { country?: string | null; at?: LatLng | null }): MapProviderId {
  if (hint.country) return providerForCountry(hint.country);
  if (hint.at) return isInKorea(hint.at) ? 'kakao' : 'google';
  return 'kakao';
}
