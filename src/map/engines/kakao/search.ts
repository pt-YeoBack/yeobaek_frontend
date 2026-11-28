// [지도] //추가 카카오api 넣어야함 (JavaScript 키 → .env.local 의 VITE_KAKAO_MAP_KEY)
// 카카오에게 "이 이름의 장소 어디예요?", "이 좌표 주소가 뭐예요?" 를 물어보는 통역사.
// kakao.maps.* 는 가이드 규칙대로 engines/ 안에서만 써요.
import type { LatLng, Place, PlaceSearcher } from '../../core/types';

// SDK 는 MapView(core)가 불러와요. 타입 파일이 없는 외부 스크립트라 any 로 꺼내요.
function kakaoMaps() {
  const maps = (window as any).kakao?.maps;
  if (!maps?.services) throw new Error('카카오 지도가 아직 준비되지 않았어요.');
  return maps;
}

export const kakaoSearcher: PlaceSearcher = {
  // 이름으로 검색
  async search(query: string): Promise<Place[]> {
    const { services } = kakaoMaps();
    // Promise: 나중에 오는 답을 await 로 기다릴 수 있게 감싸는 상자
    return new Promise<Place[]>((resolve, reject) => {
      new services.Places().keywordSearch(
        query,
        (rows: any[], status: string) => {
          if (status === services.Status.ZERO_RESULT) return resolve([]);
          if (status !== services.Status.OK) return reject(new Error('카카오 장소 검색에 실패했어요.'));
          resolve(
            rows.map((r) => ({
              provider: 'kakao',
              providerPlaceId: String(r.id),
              name: r.place_name,
              address: r.road_address_name || r.address_name,
              lat: Number(r.y), // 카카오는 y 가 위도
              lng: Number(r.x), // x 가 경도
            })),
          );
        },
        { size: 10 },
      );
    });
  },

  // 좌표 → 주소
  async reverseGeocode(at: LatLng): Promise<Place | null> {
    const { services } = kakaoMaps();
    return new Promise<Place | null>((resolve, reject) => {
      // 순서 주의: 경도(lng), 위도(lat)
      new services.Geocoder().coord2Address(at.lng, at.lat, (rows: any[], status: string) => {
        if (status === services.Status.ZERO_RESULT) return resolve(null);
        if (status !== services.Status.OK) return reject(new Error('카카오 주소 변환에 실패했어요.'));
        const road = rows[0]?.road_address;
        const address = road?.address_name || rows[0]?.address?.address_name;
        resolve(address ? { provider: 'kakao', name: road?.building_name || address, address, ...at } : null);
      });
    });
  },
};
