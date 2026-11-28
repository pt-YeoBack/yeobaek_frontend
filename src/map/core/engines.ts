// [지도] //추가 카카오api 넣어야함
// 어댑터 보관함: 'kakao' 라고 하면 카카오 엔진, 'google' 이라고 하면 구글 엔진을 꺼내 줘요.
import { googleEngine } from '../engines/google/googleEngine';
import { kakaoEngine } from '../engines/kakao/kakaoEngine';
import type { MapEngine, MapProviderId } from './types';

const ENGINES: Record<MapProviderId, MapEngine> = { kakao: kakaoEngine, google: googleEngine };

export function getEngine(id: MapProviderId): MapEngine {
  return ENGINES[id];
/**
 * 공급자 id → 엔진. 공급자를 바꾸거나 추가할 때는 여기와 engines/ 만 바꾼다.
 * (core 가 engines 를 아는 유일한 곳. 기능 모듈 route · place 는 이 파일을 거쳐서만 엔진을 쓴다)
 */
const ENGINES: Record<MapProviderId, MapEngine> = {
  google: googleEngine,
  kakao: kakaoEngine,
};

export function getEngine(provider: MapProviderId): MapEngine {
  return ENGINES[provider];
}
