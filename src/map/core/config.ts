// [지도] //추가 카카오api 넣어야함 · 구글api 넣어야함
// 지도 설정판: 키 · 처음 보여 줄 곳 · 색을 한곳에 모았어요.
// 키는 여기에 직접 쓰지 말고 .env.local 에 넣어요. import.meta.env = .env.local 값을 읽는 통로
import type { LatLng, MapProviderId } from './types';

export const MAP_KEYS = {
  // 카카오api 넣어야함 → .env.local 의 VITE_KAKAO_MAP_KEY (JavaScript 키. REST API 키 아님)
  kakao: String(import.meta.env.VITE_KAKAO_MAP_KEY ?? '').trim(),
  // 구글api 넣어야함 → .env.local 의 VITE_GOOGLE_MAPS_API_KEY
  google: String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim(),
  // (선택) VITE_GOOGLE_MAP_ID. 있으면 카카오와 같은 마커 모양
  googleMapId: String(import.meta.env.VITE_GOOGLE_MAP_ID ?? '').trim(),
};

/** 좌표를 하나도 안 줬을 때: 카카오 = 서울, 구글 = 도쿄 */
export const DEFAULT_CENTER: Record<MapProviderId, LatLng> = {
  kakao: { lat: 37.5665, lng: 126.978 },
  google: { lat: 35.6812, lng: 139.7671 },
};

/** 구글 기준 확대 정도 */
export const DEFAULT_ZOOM = 14;

/** fitBounds 때 가장자리 여백(px) */
export const FIT_PADDING = 48;

export const MAP_COLORS = {
  marker: '#244790', // 여백 메인 블루
  line: '#2f6bff',
  text: '#ffffff',
};
