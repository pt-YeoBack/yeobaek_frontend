import { ChangeEvent, useEffect, useRef, useState } from 'react';
// //추가 모임 만들기 요청(createTogether), 만든 모임 다시 받기(fetchTogether),
//        화면 id 이름표('srv-'), 서버 모양 → 화면 모양 번역기(toGathering)
import { createTogether, fetchTogether, SERVER_PREFIX, toGathering, uploadTogetherPhotos } from '../api/together'; // //수정 uploadTogetherPhotos 추가 → 만든 뒤 사진 올리기
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav, ConfirmDialog } from '../components/TripParts';
import { camera, chevronRight18 } from '../components/icons'; // //수정 chevronRight18 = "지도" 줄 오른쪽 › 화살표
import { useAppState } from '../lib/appState';
import { addDays, formatMDW, todayISO } from '../lib/dates';
import { useNav } from '../lib/navigation';
// [지도] //수정 구글 키를 받아서 주석 해제 : 지도 모듈은 src/map/index.ts 에서만 import (가이드 규칙)
//  //수정 지도는 화면 가득 여는 GatheringPlacePicker(같은 pages 폴더)가 그려요 → 여기서는 회사 · 검색기만 고름
//  providerForRegion = 국내/해외에 맞는 지도 회사 고르기, searcherFor = 그 회사의 장소 검색기
import { providerForRegion, savePlace, searcherFor, type Place } from '../map'; // //수정 savePlace 추가 → 고른 장소를 서버(tbl_place)에 저장하고 번호 받기
import { GatheringPlacePicker } from './GatheringPlacePicker'; // //추가 "지도" 를 누르면 열리는 화면 가득 지도 (당근 거래 희망 장소처럼)
// //추가 로그인한 내 정보(회원 번호) 꺼내기 → 방금 만든 모임의 모임장이 나인지 표시하는 데 사용
import { getSessionUser } from '../lib/session';
import { tripDates, useTrips } from '../lib/tripStore';
import { GatheringKind, useWorld } from '../lib/worldStore';

const MAX_PHOTOS = 10;

interface Form {
  photos: string[];
  title: string;
  description: string;
  kind: GatheringKind | null;
  distance: '근처' | '다른 지역' | null;
  maxPeople: string;
  place: string;
  // [지도] //수정 주석 해제 : 지도에서 고른 장소 한 곳 (이름 · 주소 · 좌표). 아직 안 골랐으면 null
  picked: Place | null;
  date: string;
  start: string;
  end: string;
}

const EMPTY: Form = {
  photos: [],
  title: '',
  description: '',
  kind: null,
  distance: null,
  maxPeople: '',
  place: '',
  // [지도] //수정 주석 해제 : 처음에는 고른 장소 없음
  picked: null,
  date: '',
  start: '',
  end: '',
};

/** 작성 중인 모임 — 화면을 나갔다 와도 남도록 메모리에만 보관 (새로고침하면 사라짐) */
let savedDraft: Form = EMPTY;

function readDraft(): Form {
  return savedDraft;
}

function formatTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** 사진을 작게 줄여 data URL로 (메모리 사용량 보호) */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Mobile 18 (두 번째 프레임) · 모임 만들기 */
export function GatheringCreate() {
  const { back, canGoBack, reset, replace } = useNav();
  const { showToast } = useAppState();
  const { trips } = useTrips();
  // //수정 createGathering(브라우저 메모리에만 저장) → putServerGathering(서버에서 받은 모임을 저장소에 넣기)
  const { putServerGathering } = useWorld();
  const [form, setForm] = useState<Form>(readDraft);
  const [submitted, setSubmitted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false); // //추가 "지도" 줄을 눌러 화면 가득 지도가 열렸는지
  // //추가 서버에 요청을 보내는 중인지 (true 인 동안 버튼을 잠가요)
  //  비유: 엘리베이터 버튼을 연타해도 한 번만 부르는 것처럼, 두 번 눌러 모임이 2개 생기는 걸 막아요
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 화면을 나갔다 와도 입력값이 남도록 임시 저장
  useEffect(() => {
    savedDraft = form;
  }, [form]);

  const trip = trips[0];
  // [지도] //수정 주석 해제 : 국내 → 카카오, 해외 → 구글 (카카오 키가 아직 없어서 지금은 둘 다 구글)
  const mapProvider = providerForRegion(trip?.destination?.region);
  const dateOptions = trip && tripDates(trip).length ? tripDates(trip) : Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const max = Number(form.maxPeople);
  const errors = {
    title: !form.title.trim() ? '제목을 입력해 주세요.' : form.title.trim().length < 2 ? '제목은 2자 이상 적어 주세요.' : '',
    description: form.description.trim().length < 10 ? '다른 분들이 믿고 찾아올 수 있도록 10자 이상 적어 주세요.' : '',
    kind: !form.kind || !form.distance ? '모임 성격(식사·관광지)과 거리(근처·다른 지역)를 하나씩 골라 주세요.' : '',
    maxPeople: !form.maxPeople ? '최대 인원을 입력해 주세요.' : !Number.isInteger(max) || max < 2 || max > 6 ? '최대 인원은 나를 포함해 2~6명이에요.' : '',
    place: !form.place.trim() ? '모이는 장소를 입력해 주세요.' : '',
    time: !form.date
      ? '모이는 날짜를 골라 주세요.'
      : !validTime(form.start) || !validTime(form.end)
        ? '시작·종료 시간을 00:00 형식으로 입력해 주세요.'
        : form.end <= form.start
          ? '종료 시간은 시작 시간보다 늦어야 해요.'
          : new Date(`${form.date}T${form.start}`) <= new Date() // //추가 휴대폰 시계 기준으로 이미 지난 시간이면
            ? '지금보다 나중 시간으로 골라 주세요.' // //추가 지난 약속으로는 아무도 못 오니 막음 (서버는 시간대가 달라 이 검사를 화면에서만 해요)
            : '',
  };
  const hasError = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (submitted && errors[k] ? errors[k] : '');

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    const room = MAX_PHOTOS - form.photos.length;
    if (files.length > room) showToast(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`, 'error');
    try {
      const urls = await Promise.all(files.slice(0, room).map(shrink));
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch {
      showToast('사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.', 'error');
    }
  };

  // //수정 모임 만들기: 브라우저 메모리 저장 → 서버(DB) 저장
  //  async: 안에서 await(서버 답 기다리기)를 쓰려면 함수 앞에 붙여야 해요
  const submit = async () => {
    setSubmitted(true);
    if (hasError || !form.kind || !form.distance) {
      showToast('입력하지 않은 항목이 있어요. 표시된 부분을 확인해 주세요.', 'error');
      return;
    }
    if (busy) return; // //추가 이미 요청 중이면 무시 (두 번 누르기 방지)

    // //추가 ① 화면 값 → 서버 값으로 바꿔서 "모임 만들어 주세요" 요청 (POST /api/together/write)
    //  화면은 'dining' / '근처' 처럼 쓰고, 서버(DB enum)는 'meal' / 'near' 처럼 소문자 영어를 써서 바꿔 줘요
    //  //수정 날짜 · 시간도 같이 보내요. 사진은 모임 번호가 생긴 뒤 ②-1 에서 따로 올려요
    setBusy(true);
    let placeId: number | null = null; // [지도] //수정 주석 해제 : 지도에서 고른 장소의 서버 번호 (안 골랐으면 null = 이름만 저장)
    if (form.picked) { // [지도] 지도에서 골랐으면 먼저 장소를 저장 → 그 번호를 모임에 붙여야 참여자가 같은 핀을 봄
      const saved = await savePlace(form.picked); // POST /api/places → PlaceService (같은 장소면 기존 번호)
      if (saved.ok) placeId = saved.place.id;
      else showToast('지도 위치는 저장하지 못했어요. 장소 이름만 저장할게요.', 'error'); // 실패해도 모임은 만듦 (DB 장소 SQL 을 아직 안 돌렸을 때 등)
    }
    const r = await createTogether({
      togetherTitle: form.title.trim(),           // trim(): 앞뒤 빈칸 지우기
      togetherContent: form.description.trim(),
      togetherPurpose: form.kind === 'dining' ? 'meal' : 'spot', // 조건 ? 참일 때 : 거짓일 때
      togetherArea: form.distance === '근처' ? 'near' : 'other',
      togetherMaxMember: max,
      // //수정 togetherPlace → placeName : 백엔드 TogetherDTO 필드 이름과 똑같이 맞춤 (다르면 서버가 값을 버려 null 로 저장됨)
      //  form.place = 화면의 "모이는 위치" 입력칸 값. 비어 있으면 위의 errors.place 검사에서 이미 막혀요
      placeName: form.place.trim(),
      togetherStartDate: `${form.date}T${form.start}:00`, // //추가 "2026-12-01" + "19:00" → "2026-12-01T19:00:00" (백엔드 LocalDateTime 이 읽는 모양)
      togetherEndDate: `${form.date}T${form.end}:00`, // //추가 같은 날 끝나는 시각 → 상세 화면 "19:00–20:30" 에 그대로 보임
      placeId, // [지도] //수정 주석 해제 : 위에서 받은 장소 번호 → tbl_get_together.place_id
    });
    if (!r.ok) {
      // 실패: 서버가 보낸 안내 문구(예: "최대 인원은 2명부터 6명까지예요.")를 그대로 보여 줘요
      setBusy(false);
      showToast(r.message ?? '모임을 만들지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      return;
    }

    if (form.photos.length) { // //추가 ②-1 고른 사진이 있으면 (모임 번호가 있어야 "몇 번 모임 사진" 인지 알 수 있어서 만든 뒤에 올림)
      const blobs = await Promise.all(form.photos.map((p) => fetch(p).then((res) => res.blob()))); // //추가 미리보기용 data URL → 파일(Blob) 로 되돌리기 (shrink 로 줄인 사진이라 가벼움)
      const up = await uploadTogetherPhotos(r.togetherId, blobs); // //추가 POST /api/together/{번호}/photos → tbl_file + tbl_file_together 에 저장
      if (!up.ok) showToast(up.message ?? '모임은 만들었지만 사진을 올리지 못했어요.', 'error'); // //추가 모임은 이미 생겼으니 사진 실패만 알려 줌
    }

    // //추가 ② 방금 만든 모임을 서버에서 다시 받아 저장소에 넣어요
    //  (모임장 = 나 → 인원 1명, 참여 중 = true)
    //  비유: 주문하고 받은 "주문 번호(togetherId)"로 주문 내역을 다시 조회하는 것
    const d = await fetchTogether(r.togetherId);
    if (d.ok) putServerGathering(toGathering(d.together, getSessionUser()?.id ?? null, d.members), true);
    setBusy(false);

    setForm(EMPTY);
    savedDraft = EMPTY;
    showToast('모임을 만들었어요.', 'success'); // //수정 "데모 모임" 문구 제거
    // //수정 ③ 서버 모임 화면 id('srv-번호')로 상세 화면 이동
    //  replace: 뒤로 가기를 눌렀을 때 "모임 만들기" 화면으로 다시 돌아오지 않게, 지금 화면을 바꿔 끼워요
    replace({ name: 'gathering', id: `${SERVER_PREFIX}${r.togetherId}` });
  };

  const leave = () => (canGoBack ? back() : reset({ name: 'connections' }));
  const touched = JSON.stringify({ ...form }) !== JSON.stringify(EMPTY);

  return (
    <ScreenShell
      frame="Mobile 18 Create Gathering"
      tone="brand"
      title="모임 만들기"
      onBack={() => (touched ? setConfirmCancel(true) : leave())}
      trailing={<BellButton />}
      surface="mist"
      contentClassName="gather-form"
      bottomNav={<BottomNav active="connections" />}
    >
      <div className="photo-row">
        <button type="button" className="photo-add" onClick={() => fileRef.current?.click()} aria-label={`사진 추가 (${form.photos.length}/${MAX_PHOTOS})`}>
          <img src={camera} alt="" width={18} height={18} />
          <small>
            {form.photos.length}/{MAX_PHOTOS}
          </small>
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        {form.photos.map((p, i) => (
          <span key={i} className="photo-thumb">
            <img src={p} alt={`올린 사진 ${i + 1}`} />
            {i === 0 && <small>대표사진</small>}
            <button
              type="button"
              aria-label={`사진 ${i + 1} 삭제`}
              onClick={() => set({ photos: form.photos.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <label className="form-block">
        <span className="form-title is-large">제목</span>
        <span className="form-title-hint" id="title-hint">아침에 천천히 걸어요. 모임장 포함 5명이에요.</span>
        <input
          className="soft-input"
          value={form.title}
          maxLength={30}
          placeholder="모임 제목을 입력해 주세요"
          aria-describedby="title-hint"
          aria-invalid={Boolean(show('title')) || undefined}
          onChange={(e) => set({ title: e.target.value })}
        />
        {show('title') && <span className="inline-error">{show('title')}</span>}
      </label>

      <label className="form-block">
        <span className="form-title">자세한 내용</span>
        <textarea
          className="soft-input"
          rows={3}
          value={form.description}
          maxLength={300}
          placeholder="모임 내용을 간단히 적어 주세요"
          aria-invalid={Boolean(show('description')) || undefined}
          onChange={(e) => set({ description: e.target.value })}
        />
        {show('description') && <span className="inline-error">{show('description')}</span>}
      </label>

      <div className="purpose-chips" role="group" aria-label="모임 성격과 거리">
        {(
          [
            ['kind', 'dining', '같이 식사하고 싶어요.'],
            ['kind', 'sightseeing', '같이 관광지 갈래요.'],
            ['distance', '근처', '근처에서 먹을 거에요.'],
            ['distance', '다른 지역', '다른 지역으로 갈 거에요.'],
          ] as const
        ).map(([field, value, label]) => {
          const on = form[field] === value;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              className={`purpose-chip ${on ? 'is-on' : ''}`}
              onClick={() => set({ [field]: on ? null : value } as Partial<Form>)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {show('kind') && <p className="inline-error">{show('kind')}</p>}

      <label className="form-block">
        <span className="form-title">최대 인원 설정 ({form.maxPeople && !errors.maxPeople ? form.maxPeople : 0} / 6 명)</span>
        <input
          className="soft-input input-short"
          inputMode="numeric"
          value={form.maxPeople}
          placeholder="최대 인원을 입력해 주세요"
          aria-invalid={Boolean(show('maxPeople')) || undefined}
          onChange={(e) => set({ maxPeople: e.target.value.replace(/\D/g, '').slice(0, 1) })}
        />
        {show('maxPeople') && <span className="inline-error">{show('maxPeople')}</span>}
      </label>

      <label className="form-block">
        <span className="form-title">모이는 위치</span>
        <textarea
          className="soft-input"
          rows={2}
          value={form.place}
          maxLength={60}
          placeholder="모임 장소를 알려주세요" // //수정 지도는 아래 "지도" 에서 따로 열어서 안내 문구 변경
          aria-invalid={Boolean(show('place')) || undefined}
          onChange={(e) => set({ place: e.target.value })}
        />
        {show('place') && <span className="inline-error">{show('place')}</span>}
      </label>

      <div className="form-block">{/* //추가 "지도" 줄 → 누르면 화면 가득 지도 (휴대폰에서 크게 보고 고르기) */}
        <button type="button" className="place-row" onClick={() => setPlaceOpen(true)}>
          <span className="form-title">지도</span>{/* //추가 모이는 위치와 같은 글자 크기 */}
          <span className="place-row-value">
            {form.picked ? form.picked.name : '장소 선택'}{/* //추가 등록했으면 적은 장소명 (예: 난바역 3번 출구) */}
            <img src={chevronRight18} alt="" width={18} height={18} />
          </span>
        </button>
        {form.picked && <span className="form-help">{form.picked.address}</span>}{/* //추가 지도에서 고른 곳의 주소 */}
      </div>
      <fieldset className="form-block">
        <legend className="form-title">모이는 시간</legend>
        <div className="time-fields soft-input">
          <select aria-label="모이는 날짜" value={form.date} onChange={(e) => set({ date: e.target.value })}>
            <option value="">날짜 선택</option>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {formatMDW(d)}
              </option>
            ))}
          </select>
          <input aria-label="시작 시간" inputMode="numeric" placeholder="09:00" value={form.start} onChange={(e) => set({ start: formatTime(e.target.value) })} />
          <span aria-hidden="true">–</span>
          <input aria-label="종료 시간" inputMode="numeric" placeholder="10:00" value={form.end} onChange={(e) => set({ end: formatTime(e.target.value) })} />
        </div>
        {show('time') && <span className="inline-error">{show('time')}</span>}
      </fieldset>

      {/* //수정 요청 중(busy)에는 버튼을 잠그고 글자를 "만드는 중…" 으로 */}
      <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
        {busy ? '만드는 중…' : '모임 만들기'}
      </button>
      {/* //수정 사진 · 날짜 · 시간이 저장되니 "준비 중" 안내 대신 만든 뒤 할 수 있는 일 안내 */}
      <p className="footnote center">첫 번째 사진이 대표사진이 돼요. 모임장은 만든 뒤 모집 마감 · 모임 끝내기를 할 수 있어요.</p>

      {placeOpen && ( // //추가 화면 가득 지도 → 선택 완료 → 장소명 입력 → 등록
        <GatheringPlacePicker
          provider={mapProvider}
          searcher={searcherFor(mapProvider)}
          initial={form.picked} // 전에 고른 곳에서 다시 시작
          onClose={() => setPlaceOpen(false)} // × → 그대로 닫기
          onDone={(picked) => { // "모임 장소 등록" → 핀 위치는 picked, 적은 장소명은 "모이는 위치" 칸으로
            set({ picked, place: picked.name });
            setPlaceOpen(false);
          }}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="모임 만들기를 멈출까요?"
          message="입력한 내용은 임시로 남아 있어서 다음에 이어서 쓸 수 있어요."
          confirmLabel="나가기"
          cancelLabel="계속 쓰기"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false);
            leave();
          }}
        />
      )}
    </ScreenShell>
  );
}
