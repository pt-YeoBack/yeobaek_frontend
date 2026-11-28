// [지도] //추가 카카오api 넣어야함
// 기능 모음 창구. src/map/index.ts 가 이 파일을 밖으로 내보내요. //수정 core 를 만들어서 안내 문구 변경
import { MAP_KEYS } from './core/config'; // //추가 카카오 키가 들어 있는지 확인하려고
import type { PlaceSearcher } from './core/types';
import { googleSearcher } from './engines/google/search';
import { kakaoSearcher } from './engines/kakao/search';

export { PlacePicker } from './place/PlacePicker';
export { PlaceSearchBox } from './place/PlaceSearchBox';
export { PlacesMap } from './place/PlacesMap';
export { fetchPlaces, savePlace } from './place/placeApi';
export { RouteMap } from './route/RouteMap';
export { useRoute } from './route/useRoute';

/** 국내 여행 → 카카오, 해외 여행 → 구글. 여행이 없으면 카카오 */
// //수정 카카오 키가 아직 없으면 국내 여행도 구글로 (구글 지도는 한국도 그려요. 키가 없는 카카오로 가면 "키가 없어요" 안내만 떠요)
//  비유: 카카오 창구가 아직 문을 안 열었으면, 열려 있는 구글 창구로 안내
//  카카오 키(.env.local 의 VITE_KAKAO_MAP_KEY)를 넣으면 원래대로 국내 = 카카오
export function providerForRegion(region?: 'domestic' | 'overseas'): 'kakao' | 'google' {
  if (!MAP_KEYS.kakao) return 'google'; // //추가
  return region === 'overseas' ? 'google' : 'kakao';
}

/** 지도와 검색은 같은 회사로 (가이드 약관 규칙) */
export function searcherFor(provider: 'kakao' | 'google'): PlaceSearcher {
  return provider === 'kakao' ? kakaoSearcher : googleSearcher;
}
