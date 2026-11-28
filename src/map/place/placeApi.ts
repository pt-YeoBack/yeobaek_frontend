// [지도] //추가 카카오api 넣어야함
// 장소 주문서 창구: 우리 서버(/api/places)에 저장 · 조회를 부탁해요.
import { errorReason } from '../../api/error'; // 실패 이유 꺼내기
import ajax from '../../utils/ajax'; // '/api' 와 로그인 토큰을 자동으로 붙여 주는 도구
import type { Place } from '../core/types';

export type SavedPlace = Place & { id: number };

/** 저장 → 우리 DB 번호(id)가 붙어서 돌아옴 */
export async function savePlace(
  place: Place,
): Promise<{ ok: true; place: SavedPlace } | { ok: false; message: string | null }> {
  try {
    const { data } = await ajax.post('/places', place);
    return { ok: true, place: data as SavedPlace };
  } catch (error) {
    return { ok: false, message: errorReason(error).message };
  }
}

/** 번호들로 좌표 조회. 실패하면 핀 없이 지도만 보이게 빈 목록 */
export async function fetchPlaces(ids: number[]): Promise<SavedPlace[]> {
  if (!ids.length) return [];
  try {
    const { data } = await ajax.get('/places', { params: { ids: ids.join(',') } });
    return data as SavedPlace[];
  } catch {
    return [];
  }
}
