// [지도] //추가 카카오api 넣어야함
// 장소 고르기: 검색해서 고르거나, 지도를 콕 눌러 고르면 onSelect(place) 로 알려 줘요.
import { useEffect, useMemo, useRef, useState } from 'react'; // //수정 useEffect 추가 → 밖에서 바뀐 위치로 지도 옮기기
import { MapView } from '../core/MapView'; // core 의 지도 부품 //수정 안내 문구
import type { LatLng, MapHandle, MapMarker, Place, PlaceSearcher } from '../core/types';
import { PlaceSearchBox } from './PlaceSearchBox';

interface Props {
  provider: 'kakao' | 'google';
  searcher: PlaceSearcher;
  value: Place | null;
  onSelect: (place: Place) => void;
}

export function PlacePicker({ provider, searcher, value, onSelect }: Props) {
  const map = useRef<MapHandle | null>(null); // 지도 리모컨
  const latest = useRef(0); // 마지막으로 고른 것만 반영
  const [ready, setReady] = useState(false);

  // useMemo: 값이 바뀔 때만 마커를 다시 만들기 (가이드 필수 규칙)
  const markers = useMemo<MapMarker[]>(
    () =>
      value
        ? [{ id: 'picked', position: { lat: value.lat, lng: value.lng }, title: value.name, selected: true }]
        : [],
    [value],
  );

  const fromHere = useRef(false); // //추가 이 부품 안(검색 · 지도 누르기)에서 고른 건지 → 그때는 아래 useEffect 가 지도를 안 옮김

  useEffect(() => { // //추가 밖(예: 모임 만들기의 "현위치")에서 value 가 바뀌면 그 위치로 지도 이동 → 핀이 화면 밖에 있지 않게
    if (fromHere.current) {
      fromHere.current = false; // 안에서 고른 것: 검색은 select 가 이미 옮겼고, 지도 누르기는 이미 보이는 곳이라 그대로
      return;
    }
    if (ready && value) map.current?.setCenter({ lat: value.lat, lng: value.lng }, 16); // 지도 준비가 끝났을 때만
  }, [ready, value]);

  const select = (place: Place) => {
    fromHere.current = true; // //추가 검색으로 고름
    latest.current++;
    onSelect(place);
    map.current?.setCenter({ lat: place.lat, lng: place.lng }, 16);
  };

  const pickAt = async (at: LatLng) => {
    const turn = ++latest.current;
    let found: Place | null = null;
    try {
      found = await searcher.reverseGeocode(at);
    } catch {
      // 주소를 못 받아도 좌표로 고를 수는 있어야 해서 아래 기본값 사용
    }
    if (turn !== latest.current) return;
    const coords = `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`;
    fromHere.current = true; // //추가 지도를 눌러 고름
    onSelect(found ?? { provider, name: '지도에서 고른 위치', address: coords, ...at });
  };

  return (
    <div>
      <PlaceSearchBox key={provider} searcher={searcher} disabled={!ready} onSelect={select} />
      <MapView
        provider={provider}
        markers={markers}
        onMapClick={pickAt}
        onReady={(handle) => {
          map.current = handle;
          setReady(true);
        }}
        style={{ height: 280 }}
      />
      {value && (
        <p role="status">
          선택한 위치: {value.name} · {value.address}
        </p>
      )}
    </div>
  );
}
