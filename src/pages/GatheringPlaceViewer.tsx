// //추가 (새 파일) 모임장이 정한 모이는 위치 보기 — 모임 상세의 "지도로 확인해보아요" 를 누르면 열림
//  참여자는 보기만 해요: 지도를 움직이고 확대해서 주변(무슨 역 · 몇 번 출구 근처인지)을 볼 수 있지만, 위치를 바꾸거나 저장하는 버튼은 없어요
import { useEffect, useMemo, useState } from 'react';
import { fetchPlaces, MapView, type MapMarker, type Place } from '../map'; // 지도 모듈은 index.ts 에서만 import (가이드 규칙)

interface Props {
  placeId: number; // 모임장이 정한 장소 번호 (tbl_get_together.place_id) → 서버에서 좌표를 받아 옴
  title: string; // 모임장이 적은 장소명 (예: 난바역 3번 출구) → 핀 이름 · 맨 위 굵은 글씨
  onClose: () => void; // × · 확인 → 상세 화면으로
}

export function GatheringPlaceViewer({ placeId, title, onClose }: Props) {
  const [place, setPlace] = useState<Place | null>(null); // 서버에서 받은 장소 (좌표 · 주소 · 지도 회사)
  const [failed, setFailed] = useState(false); // 못 받았을 때 안내

  useEffect(() => { // 열리면 GET /api/places?ids=번호 → PlaceApiController → tbl_place
    let alive = true; // 닫은 뒤 늦게 온 답은 버림
    fetchPlaces([placeId]).then((list) => {
      if (!alive) return;
      if (list[0]) setPlace(list[0]);
      else setFailed(true); // 서버 꺼짐 · 없는 번호
    });
    return () => {
      alive = false;
    };
  }, [placeId]);

  const markers = useMemo<MapMarker[]>( // 핀 하나 (useMemo: 매번 새로 만들면 지도가 계속 다시 그려져서 — 지도 모듈 규칙)
    () => (place ? [{ id: 'meet', position: { lat: place.lat, lng: place.lng }, title, selected: true }] : []),
    [place, title],
  );

  return (
    <div className="place-full" role="dialog" aria-modal="true" aria-labelledby="place-view-title">{/* 모임 장소 고르기와 같은 화면 가득 틀 */}
      <div className="place-full-head">
        <button type="button" className="place-full-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
        <h2 id="place-view-title" className="place-full-title">
          모임장이 정한
          <br />
          모이는 위치예요.
        </h2>
        <div className="place-view-info">{/* 어디인지 글자로도 확인 */}
          <strong>{title}</strong>
          <span>{place ? place.address : failed ? '지도 위치를 불러오지 못했어요.' : '위치를 불러오는 중…'}</span>
        </div>
      </div>

      {place ? (
        <MapView
          provider={place.provider} // 모임장이 고를 때 쓴 지도 회사 그대로
          center={{ lat: place.lat, lng: place.lng }} // 핀이 가운데 오게
          zoom={17} // 역 출구 · 골목이 보이는 확대
          markers={markers}
          // onMapClick 을 일부러 안 넘김 → 지도를 눌러도 아무것도 안 바뀜 (보기 전용)
          style={{ flex: 1, height: 'auto' }}
        />
      ) : (
        <div className="place-view-empty">{failed ? '모임장이 적은 장소 이름으로 확인해 주세요.' : ''}</div>
      )}

      <div className="place-full-foot">
        <p className="form-help place-view-note">지도를 움직이거나 확대해서 주변 역 · 출구를 볼 수 있어요. 위치는 모임장만 정할 수 있어요.</p>
        <button type="button" className="btn-primary" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
