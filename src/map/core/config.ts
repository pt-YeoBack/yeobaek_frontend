import type { LatLng, MapProviderId } from './types';

/**
 * 지도 키 · 기본값 (yeoback_front/.env.local — git 에 올라가지 않음, .env.example 참고)
 *  VITE_GOOGLE_MAPS_API_KEY : 구글 Maps JavaScript API 브라우저 키 (HTTP 리퍼러 제한 필수)
 *  VITE_GOOGLE_MAP_ID       : 구글 Cloud Console 의 Map ID (선택, 있으면 최신 마커 사용)
 *  VITE_KAKAO_MAP_KEY       : 카카오 개발자 앱의 JavaScript 키 (플랫폼 > Web 에 도메인 등록 필수)
 */
export const MAP_CONFIG = {
  googleApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  googleMapId: import.meta.env.VITE_GOOGLE_MAP_ID ?? '',
  kakaoAppKey: import.meta.env.VITE_KAKAO_MAP_KEY ?? '',
  language: 'ko',
} as const;

/** 공급자별 기본 중심 (center 를 안 넘겼을 때) */
export const DEFAULT_CENTER: Record<MapProviderId, LatLng> = {
  kakao: { lat: 37.5665, lng: 126.978 }, // 서울시청
  google: { lat: 35.6812, lng: 139.7671 }, // 도쿄역
};

export const DEFAULT_ZOOM = 14;

/** 브랜드 색 (마커 · 선 기본색). 화면 테마 색은 CSS 변수 --brand-700 을 따른다 */
export const MAP_COLORS = {
  brand: '#244790',
  accent: '#2f6bff',
  muted: '#9ca3af',
} as const;

export function hasKey(provider: MapProviderId): boolean {
  return provider === 'google' ? Boolean(MAP_CONFIG.googleApiKey) : Boolean(MAP_CONFIG.kakaoAppKey);
}
