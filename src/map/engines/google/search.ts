// [지도] //추가 구글api 넣어야함 (VITE_GOOGLE_MAPS_API_KEY, Places API (New) · Geocoding API 켜기)
// 해외 장소 검색 담당. google.maps.* 는 engines/ 안에서만 써요.
import type { LatLng, Place, PlaceSearcher } from '../../core/types';

function googleMaps() {
  const maps = (window as any).google?.maps;
  if (!maps?.importLibrary) throw new Error('구글 지도가 아직 준비되지 않았어요.');
  return maps;
}

export const googleSearcher: PlaceSearcher = {
  // 이름으로 검색
  async search(query: string): Promise<Place[]> {
    const { Place: GooglePlace } = await googleMaps().importLibrary('places');
    const { places } = await GooglePlace.searchByText({
      textQuery: query,
      fields: ['id', 'displayName', 'formattedAddress', 'location'], // 필요한 칸만 (요금 절약)
      maxResultCount: 10,
    });
    return (places as any[])
      .filter((p) => p.location)
      .map((p) => ({
        provider: 'google',
        providerPlaceId: p.id,
        name: p.displayName || query,
        address: p.formattedAddress || p.displayName || query,
        lat: p.location.lat(),
        lng: p.location.lng(),
      }));
  },

  // 좌표 → 주소
  async reverseGeocode(at: LatLng): Promise<Place | null> {
    const { Geocoder } = await googleMaps().importLibrary('geocoding');
    const { results } = await new Geocoder().geocode({ location: at });
    const address = results[0]?.formatted_address;
    return address ? { provider: 'google', name: address, address, ...at } : null;
  },
};
