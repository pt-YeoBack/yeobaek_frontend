// [지도] //추가 카카오api 넣어야함
// 어댑터 보관함: 'kakao' 라고 하면 카카오 엔진, 'google' 이라고 하면 구글 엔진을 꺼내 줘요.
import { googleEngine } from '../engines/google/googleEngine';
import { kakaoEngine } from '../engines/kakao/kakaoEngine';
import type { MapEngine, MapProviderId } from './types';

const ENGINES: Record<MapProviderId, MapEngine> = { kakao: kakaoEngine, google: googleEngine };

export function getEngine(id: MapProviderId): MapEngine {
  return ENGINES[id];
}
