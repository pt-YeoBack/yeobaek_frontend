// //추가 (새 파일) 모임 장소 고르기 — 화면 가득 지도 (모임 만들기의 "지도" 줄을 누르면 열림)
//  순서: 지도를 움직여 가운데 핀을 맞춤 → "선택 완료" → "장소명" 입력 (예: 난바역 3번 출구) → "모임 장소 등록" → 모임 만들기의 "모이는 위치" 에 들어감
import { useRef, useState } from 'react';
import { BottomSheet } from '../components/TripParts'; // 장소명 입력 시트 (아래에서 올라오는 창, 다른 화면과 같은 모양)
import { locate } from '../components/icons'; // 현위치 아이콘
import { useAppState } from '../lib/appState'; // showToast (위치 권한 거절 안내)
import { MapView, PlaceSearchBox, type LatLng, type MapHandle, type Place, type PlaceSearcher } from '../map'; // 지도 모듈은 index.ts 에서만 import (가이드 규칙)

interface Props {
  provider: 'kakao' | 'google'; // 어느 회사 지도인지 → GatheringCreate 의 mapProvider (국내 카카오 · 해외 구글)
  searcher: PlaceSearcher; // 같은 회사의 검색기 → 장소 검색 · 좌표 → 주소
  initial: Place | null; // 전에 고른 장소 → 다시 열면 그 자리에서 시작
  onDone: (place: Place) => void; // "모임 장소 등록" → GatheringCreate 가 picked · 모이는 위치 칸에 넣음
  onClose: () => void; // × → 아무것도 안 바꾸고 닫기
}

const NEAR = 0.0003; // 위도/경도 0.0003 ≈ 30m → 검색한 곳에서 이만큼 안 움직였으면 "그 장소" 로 봄

export function GatheringPlacePicker({ provider, searcher, initial, onDone, onClose }: Props) {
  const { showToast } = useAppState();
  const map = useRef<MapHandle | null>(null); // 지도 리모컨 → 가운데 좌표 읽기 · 옮기기
  const searched = useRef<Place | null>(null); // 검색해서 고른 곳 → 장소명 칸을 그 이름으로 미리 채움 (예: 난바역)
  const [ready, setReady] = useState(false); // 지도 준비 끝 → 검색 · 선택 완료 버튼 켜기
  const [locating, setLocating] = useState(false); // 현위치 찾는 중 → 버튼 잠금
  const [checking, setChecking] = useState(false); // 선택 완료 후 주소 찾는 중 → 버튼 글자 "주소 확인 중…"
  const [chosen, setChosen] = useState<Place | null>(null); // 선택 완료로 고른 곳 → 값이 있으면 장소명 시트가 열림
  const [name, setName] = useState(''); // 장소명 입력 칸 → "모이는 위치" 에 들어갈 글자

  const moveTo = (at: LatLng, zoom?: number) => map.current?.setCenter(at, zoom); // 지도를 옮기면 가운데 핀이 그 자리를 가리킴

  const locateMe = () => { // 현위치 버튼 → 내 위치로 지도 이동 (반영은 "선택 완료 → 등록" 에서 한 번 더 확인)
    if (locating) return;
    if (!navigator.geolocation) {
      showToast('이 기기에서는 현재 위치를 쓸 수 없어요.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition( // 휴대폰 GPS · 와이파이로 위도/경도 받기 (처음엔 브라우저가 허용할지 물어봄)
      (pos) => {
        setLocating(false);
        searched.current = null; // 검색한 장소가 아니게 됨
        moveTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17); // 17 = 골목이 보이는 확대
      },
      (err) => {
        setLocating(false);
        showToast(err.code === err.PERMISSION_DENIED ? '위치 권한을 허용해야 현재 위치를 쓸 수 있어요.' : '현재 위치를 찾지 못했어요. 지도를 움직여 골라 주세요.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }, // 정확하게 · 10초까지 · 1분 안의 위치는 다시 씀
    );
  };

  const complete = async () => { // "선택 완료" → 가운데 좌표의 주소를 찾고 장소명 시트 열기
    const at = map.current?.getCenter(); // 지금 가운데 핀이 가리키는 곳
    if (!at || checking) return;
    setChecking(true);
    let found: Place | null = null;
    try {
      found = await searcher.reverseGeocode(at); // 좌표 → 주소 (예: 1 Chome-9 Dotonbori …)
    } catch {
      // 주소를 못 받아도 좌표로 등록할 수 있게 아래 기본값 사용
    }
    setChecking(false);
    const s = searched.current;
    const sameAsSearched = s && Math.abs(s.lat - at.lat) < NEAR && Math.abs(s.lng - at.lng) < NEAR; // 검색한 곳 그대로인지
    const sameAsBefore = initial && Math.abs(initial.lat - at.lat) < NEAR && Math.abs(initial.lng - at.lng) < NEAR; // 전에 등록한 곳 그대로인지
    setChosen({
      provider,
      providerPlaceId: sameAsSearched ? s.providerPlaceId : null, // 검색한 장소면 지도 회사 번호도 같이 (나중에 tbl_place 저장에 씀)
      name: '',
      address: found?.address ?? `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`,
      ...at,
    });
    setName(sameAsSearched ? s.name : sameAsBefore ? initial.name : ''); // 장소명 칸 미리 채우기 (검색한 이름 · 전에 적은 이름)
  };

  const register = () => { // "모임 장소 등록" → 모임 만들기 화면으로 돌려줌
    const v = name.trim();
    if (!chosen || !v) return;
    onDone({ ...chosen, name: v.slice(0, 60) }); // 60자 = 모이는 위치 칸 maxLength 와 같게
  };

  return (
    <div className="place-full" role="dialog" aria-modal="true" aria-labelledby="place-full-title">
      <div className="place-full-head">
        <button type="button" className="place-full-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
        <h2 id="place-full-title" className="place-full-title">
          여행자들과 만나서
          <br />
          함께 모일 장소를 선택해 주세요.
        </h2>
        <PlaceSearchBox
          searcher={searcher}
          disabled={!ready}
          onSelect={(p) => { // 검색 결과를 누르면 → 그곳으로 지도 이동 + 이름 기억
            searched.current = p;
            moveTo(p, 17);
          }}
        />
      </div>

      <MapView
        provider={provider}
        center={initial ?? undefined} // 전에 고른 곳에서 시작 (없으면 기본: 카카오 서울 · 구글 도쿄)
        zoom={initial ? 17 : undefined}
        onMapClick={(at) => { // 지도를 콕 누르면 → 그 자리로 이동 (전철역 아이콘을 눌러 맞추기 쉽게)
          searched.current = null;
          moveTo(at);
        }}
        onReady={(handle) => {
          map.current = handle;
          setReady(true);
        }}
        className="place-full-map"
        style={{ flex: 1, height: 'auto' }} // 남은 높이를 지도로 꽉 채움
      >
        <div className="place-pin" aria-hidden="true">{/* 가운데 고정 핀 (지도만 움직임) */}
          <span className="place-pin-tip">지도를 움직여서 선택해 보세요</span>
          <svg width="34" height="44" viewBox="0 0 34 44">
            <path d="M17 43C17 43 33 27 33 17A16 16 0 0 0 1 17C1 27 17 43 17 43Z" fill="var(--brand-700)" />
            <circle cx="17" cy="17" r="6" fill="#ffffff" />
          </svg>
        </div>
        <button type="button" className="place-locate-fab" onClick={locateMe} disabled={locating} aria-label="현재 위치로 이동">
          <img src={locate} alt="" width={22} height={22} />
        </button>
      </MapView>

      <div className="place-full-foot">
        <button type="button" className="btn-primary" disabled={!ready || checking} onClick={complete}>
          {checking ? '주소 확인 중…' : '선택 완료'}
        </button>
      </div>

      {chosen && (
        <BottomSheet title="선택한 곳의 장소명을 입력해 주세요" onClose={() => setChosen(null)}>{/* 닫으면 다시 지도 고르기 */}
          <div className="place-name-form">
            <input
              className="soft-input"
              value={name}
              maxLength={60}
              placeholder="예) 난바역 3번 출구"
              aria-label="장소명"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 는 무시
                e.preventDefault();
                register();
              }}
            />
            <p className="form-help">{chosen.address}</p>{/* 고른 곳의 주소 → 맞게 골랐는지 확인 */}
            <button type="button" className="btn-primary" disabled={!name.trim()} onClick={register}>
              모임 장소 등록
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
