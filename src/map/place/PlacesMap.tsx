// [지도] //추가 카카오api 넣어야함
// 저장된 장소 번호(placeId)들을 받아 지도에 핀을 찍어요. (인연 목록 · 모임 상세에서 사용)
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { MapView } from '../core/MapView';
import type { MapMarker } from '../core/types';
import { fetchPlaces, SavedPlace } from './placeApi';

interface Item {
  key: string;
  title: string;
  placeId?: number | null;
  selected?: boolean;
}

interface Props {
  provider: 'kakao' | 'google';
  items: Item[];
  onSelect?: (key: string) => void;
  style?: CSSProperties;
  children?: ReactNode;
}

export function PlacesMap({ provider, items, onSelect, style, children }: Props) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);

  // 배열은 그릴 때마다 새것이 되므로, 글자로 바꿔서 "내용이 바뀌었는지" 비교해요
  const idsKey = [...new Set(items.flatMap((i) => (i.placeId ? [i.placeId] : [])))].sort((a, b) => a - b).join(',');
  const itemsKey = JSON.stringify(items.map(({ key, title, placeId, selected }) => ({ key, title, placeId, selected })));

  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  });

  useEffect(() => {
    let alive = true; // 화면을 떠난 뒤 온 답은 버리기
    fetchPlaces(idsKey ? idsKey.split(',').map(Number) : []).then((found) => {
      if (alive) setPlaces(found);
    });
    return () => {
      alive = false;
    };
  }, [idsKey]);

  const markers = useMemo<MapMarker[]>(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    return (JSON.parse(itemsKey) as Item[]).flatMap((item) => {
      const place = item.placeId ? byId.get(item.placeId) : undefined;
      // 카카오는 한국만 그리므로 같은 지도 회사의 장소만 표시
      if (!place || place.provider !== provider) return [];
      return [
        {
          id: item.key,
          position: { lat: place.lat, lng: place.lng },
          title: item.title,
          selected: item.selected,
          onClick: () => selectRef.current?.(item.key),
        },
      ];
    });
  }, [itemsKey, places, provider]);

  return (
    <MapView provider={provider} markers={markers} fitToContent style={style}>
      {children}
    </MapView>
  );
}
