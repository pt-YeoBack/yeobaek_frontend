import { useEffect, useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav, ConfirmDialog } from '../components/TripParts';
import { Avatar } from '../components/WorldParts';
import {
  cameraWhite,
  camera,
  chevronRight18,
  clock,
  cloud,
  cloudWhite,
  clover,
  footprints,
  footprintsWhite,
  heart,
  heartWhite,
  mapPin22,
  messageWhite,
  shieldCheck,
  sun,
  sunWhite,
} from '../components/icons';
import sushiPhoto from '../assets/gathering-sushi.jpg';
import asakusaPhoto from '../assets/gathering-asakusa.jpg';
import cafePhoto from '../assets/notebook-cafe.jpg';
import tokyoPhoto from '../assets/destination-tokyo.jpg';
// //추가 서버 호출 함수들: 모임 한 개 받기 · 참여 · 나가기, 그리고 서버 모양 → 화면 모양 번역기
import { changeTogetherStatus, fetchTogether, joinTogether, leaveTogether, toGathering } from '../api/together'; // //수정 changeTogetherStatus 추가 → 모임장 마감 · 끝내기 버튼
import { useAppState } from '../lib/appState';
import { formatMDW, formatShort } from '../lib/dates';
import { Route, useNav } from '../lib/navigation';
import { GatheringPlaceViewer } from './GatheringPlaceViewer'; // [지도] //수정 작은 PlacesMap 대신 "지도로 확인해보아요" → 화면 가득 보기 전용 지도
// //추가 로그인한 내 정보(회원 번호) → 참여자 목록에 내가 있는지, 모임장이 나인지 판단
import { getSessionUser } from '../lib/session';
import { Gathering, Member, useWorld } from '../lib/worldStore';
import { KIND_LABEL } from './Map';

export function gatheringPhoto(g: Gathering): string | undefined {
  if (g.photo === 'sushi') return sushiPhoto;
  if (g.photo === 'asakusa') return asakusaPhoto;
  if (g.photo === 'cafe') return cafePhoto;
  if (g.photo === 'tokyo') return tokyoPhoto;
  return g.photo || undefined;
}

const MEMBER_ICONS = {
  sun: [sun, sunWhite],
  camera: [camera, cameraWhite],
  cloud: [cloud, cloudWhite],
  footprints: [footprints, footprintsWhite],
  heart: [heart, heartWhite],
} as const;

/** Mobile 17 Dining Gathering · 함께하는 저녁 / Mobile 18 Sightseeing Gathering · 아사쿠사 산책 */
export function GatheringDetail({ route }: { route: Extract<Route, { name: 'gathering' }> }) {
  const { back, canGoBack, reset, push } = useNav();
  const { showToast } = useAppState();
  const world = useWorld();
  const g = world.getGathering(route.id);
  const [leaving, setLeaving] = useState(false);
  // //추가 서버에 요청 보내는 중인지 (true 인 동안 참여하기 버튼을 잠가 두 번 눌리지 않게)
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false); // //추가 "모임 끝내기" 확인 창을 열었는지 → 아래 ConfirmDialog 와 연결
  const [viewingMap, setViewingMap] = useState(false); // //추가 "지도로 확인해보아요" 를 눌러 보기 전용 지도가 열렸는지
  // //추가 로그인한 내 회원 번호 (로그인 안 했으면 null)
  const myId = getSessionUser()?.id ?? null;

  // //추가 서버에서 이 모임의 최신 정보(인원 · 참여자 · 모집 상태)를 받아 저장소에 넣는 함수
  //  비유: 출석부 원본(서버)을 다시 보고 칠판(화면)에 적힌 인원을 고쳐 쓰는 것.
  //  저장소가 바뀌면 React 가 알아서 화면("4 / 6명", 참여자 동그라미, 버튼)을 다시 그려요.
  //  joinedNow: 서버 참여자 목록에 내 번호가 있으면 true → "참여 완료" 로 보여요
  const refresh = async (serverId: number) => {
    const r = await fetchTogether(serverId);
    if (r.ok) {
      const joinedNow = r.members.some((m) => m.memberId === myId); // some: 하나라도 맞으면 true
      world.putServerGathering(toGathering(r.together, myId, r.members), joinedNow);
    }
    return r;
  };

  // //추가 서버 모임이면 화면에 들어올 때 한 번 최신 정보로 맞춰요
  //  (내가 안 보는 사이 다른 사람이 들어오거나 나간 것을 반영)
  //  serverId 가 없으면(예시 모임) 아무것도 안 해요
  //  ⚠️ 이 useEffect 와 위의 useState 들은 아래 `if (!g) return null;` 보다 위에 있어야 해요.
  //     React 는 매번 같은 순서 · 같은 개수로 훅(use…)이 불려야 하는데,
  //     return 아래에 두면 g 가 없을 때 개수가 달라져 오류가 나요.
  const serverId = g?.serverId;
  useEffect(() => {
    if (serverId) void refresh(serverId); // void: "결과를 기다리지 않고 실행만 한다" 는 표시
    // refresh 는 그릴 때마다 새로 만들어지는 함수라 재료 목록에 넣으면 무한 반복돼요. 그래서 serverId 만 봐요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  useEffect(() => {
    if (!g) reset({ name: 'connections' });
  }, [g, reset]);

  if (!g) return null;

  const joined = world.isJoined(g.id);
  const count = world.memberCount(g); // 서버 모임이면 서버가 세어 준 인원 (worldStore 에서 처리)
  const full = !joined && count >= g.maxPeople;
  // //추가 서버 모임이 모집 중(open)이 아니면(마감 close · 끝남 ended) 참여 버튼을 막아요
  const closed = Boolean(g.server && g.status && g.status !== 'open');
  const me = world.profile.privacy.nickname ? world.profile.nickname : '여행자';
  const isDining = g.kind === 'dining';
  const photo = gatheringPhoto(g);
  const other = world.gatherings.find((x) => x.id !== g.id && x.kind !== g.kind);

  // 모임장 → 나 → 나머지 순서 (내가 만든 모임이면 내가 모임장)
  const host = g.mine ? null : g.members.find((m) => m.role === '모임장');
  const people: (Member & { me?: boolean })[] = [
    ...(host ? [host] : []),
    ...(joined || g.mine ? [{ nickname: me, role: g.mine ? '모임장 · 나' : '나', me: true, icon: 'footprints' as const }] : []),
    ...g.members.filter((m) => m !== host),
  ];

  // //수정 "이 모임에 참여하기" 버튼
  //  - 서버 모임: 서버에 참여 요청 → 성공이든 실패든 서버의 최신 인원으로 다시 맞춤
  //  - 예시 모임: 원래처럼 이 브라우저 안에서만 참여 처리
  const joinNow = async () => {
    if (full || closed || busy) return; // 꽉 찼거나, 모집이 끝났거나, 이미 요청 중이면 아무것도 안 함

    if (g.serverId) {
      setBusy(true);
      const r = await joinTogether(g.serverId); // POST /api/together/{번호}/join → 서버에서 인원 +1
      await refresh(g.serverId);                // 늘어난 인원 · 참여자 목록 다시 받기
      setBusy(false);

      if (r.ok) {
        showToast(`${g.title} 모임에 참여했어요. 지금부터의 대화가 보여요.`, 'success'); // //수정 들어온 시각부터 대화가 보인다는 안내
        push({ name: 'chat', id: g.id }); // //추가 "모임 대화 들어가기" 를 눌렀으니 참여하자마자 대화방으로 이동
      } else if (r.reason === 'already_joined') {
        // 이미 참여한 모임이면(중복 입장) 오류를 보여 주는 대신 대화방으로 안내해요
        push({ name: 'chat', id: g.id });
      } else {
        // full(꽉 참) · not_open(모집 끝) · not_found(없는 모임) · network(서버 꺼짐) 등은 서버 문구 그대로
        showToast(r.message ?? '모임에 참여하지 못했어요.', 'error');
      }
      return;
    }

    // 예시 모임(sample)은 기존 그대로
    world.join(g.id);
    showToast(`${g.title} 모임에 참여했어요. 대화방에서 인사해 보세요.`, 'success');
    push({ name: 'chat', id: g.id }); // //추가 예시 모임도 같은 흐름 (참여 → 대화방)
  };

  const openMap = () => { // //추가 "지도로 확인해보아요" → 모임장이 정한 위치 보기 (참여 전 · 후 누구나, 보기만)
    if (g.placeId) setViewingMap(true); // 장소 번호가 있으면 → GatheringPlaceViewer
    else showToast('이 모임은 지도 위치가 없어요. 장소 이름으로 확인해 주세요.'); // 예시 모임 · 지도 없이 만든 모임
  };

  const setStatus = async (next: 'open' | 'close' | 'ended') => { // //추가 PATCH /api/together/{번호}/status 를 부르고 화면을 서버 값으로 맞춤
    if (!g.serverId || busy) return; // //추가 서버 모임만 · 요청 중이면 무시 (두 번 누르기 방지)
    setBusy(true);
    const r = await changeTogetherStatus(g.serverId, next); // //추가 서버에서 모임장인지 · 끝난 모임인지 검사
    await refresh(g.serverId); // //추가 바뀐 상태를 다시 받아 → closed 값이 바뀌어 참여 버튼 · 칩이 바로 바뀜
    setBusy(false);
    const done = { open: '다시 모집을 시작했어요.', close: '모집을 마감했어요. 새로 들어올 수 없어요.', ended: '모임을 끝냈어요. 대화는 읽기만 할 수 있어요.' }; // //추가 상태별 안내
    showToast(r.ok ? done[next] : r.message ?? '모임 상태를 바꾸지 못했어요.', r.ok ? 'success' : 'error'); // //추가 실패하면 서버 문구(예: 모임장만 할 수 있어요) 그대로
  };

  return (
    <ScreenShell
      frame={isDining ? 'Mobile 17 Dining Gathering' : 'Mobile 18 Sightseeing Gathering'}
      tone="brand"
      title={isDining ? '식사 모임' : '관광지 모임'}
      onBack={canGoBack ? back : () => reset({ name: 'connections' })}
      trailing={<BellButton />}
      surface={isDining ? 'white' : 'mist'}
      contentClassName="gathering-content"
      bottomNav={<BottomNav active="connections" />}
    >
      {photo ? <img className="gathering-hero" src={photo} alt="" /> : <span className="gathering-hero gathering-hero-empty">{g.title}</span>}
      {g.photos && g.photos.length > 1 && ( // //추가 사진이 2장 이상이면 큰 사진 아래에 작은 사진 줄 (모임 만들기의 사진 칸과 같은 모양 photo-row)
        <div className="photo-row" aria-label={`모임 사진 ${g.photos.length}장`}>
          {g.photos.map((src, i) => (
            <span key={src} className="photo-thumb">
              <img src={src} alt={`모임 사진 ${i + 1}`} />
            </span>
          ))}
        </div>
      )}

      <div className="chip-row">
        <span className="chip">
          {KIND_LABEL[g.kind]} · {g.distance}
        </span>
        <span className={`chip ${joined || g.mine ? 'chip-solid' : ''}`}>
          {joined || g.mine ? '참여 완료' : '참여 전'} · {count} / {g.maxPeople}명
        </span>
        {g.server && g.status === 'close' && <span className="chip">모집 마감</span>} {/* //추가 모임장이 마감한 모임 표시 */}
        {g.server && g.status === 'ended' && <span className="chip">끝난 모임</span>} {/* //추가 끝난 모임 표시 (대화는 읽기만) */}
        {g.sample && <span className="sample-badge">예시 모임</span>}
      </div>

      <div>
        <h2 className="gathering-heading">{g.title}</h2>
        <p className="gathering-desc">
          {g.description}
          <br />
          {host ? `${host.nickname} 모임장과 함께 ` : ''}
          {joined || g.mine ? `총 ${count}명이에요.` : `지금 ${count}명이 참여하고 있어요.`}
        </p>
      </div>

      {isDining ? (
        <section className="info-card">
          <p className="info-line info-strong">
            <img src={clock} alt="" width={18} height={18} />
            {formatMDW(g.date)} · {g.start}–{g.end}
          </p>
          <div className="info-line">
            <img src={mapPin22} alt="" width={18} height={18} />
            <div>
              <strong>{g.place}</strong>
              <span>
                {g.placeDetail}
                <br />
                {g.meetNote}
              </span>
            </div>
          </div>
          <button type="button" className="map-link" onClick={openMap}>{/* //추가 식사 모임에도 같은 링크 → openMap */}
            › 지도로 확인해보아요
          </button>
          {g.extraNote && <p className="info-extra">{g.extraNote}</p>}
        </section>
      ) : (
        <section className="info-card">
          <p className="info-date">
            {formatMDW(g.date)} · {g.start}–{g.end}
          </p>
          <div className="info-inner">
            <div className="info-line">
              <img src={mapPin22} alt="" width={18} height={18} />
              <div>
                <strong>{g.place}</strong>
                <span>
                  {g.placeDetail}
                  <br />
                  {g.meetNote}
                </span>
              </div>
            </div>
            <button type="button" className="map-link" onClick={openMap}>{/* //수정 "준비 중" 안내 → 모임장이 정한 위치 보기 */}
              › 지도로 확인해보아요
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="people-title">
        <h2 id="people-title" className="people-title">
          함께하는 사람 · {count}
          {isDining ? ` / 최대 ${g.maxPeople}명` : '명'}
        </h2>
        {!isDining && <p className="people-sub">최대 인원 {g.maxPeople}명</p>}
        <ul className="people-row">
          {people.map((m, i) => {
            const iconPair = !isDining && m.icon ? MEMBER_ICONS[m.icon] : null;
            const solid = i === 0;
            return (
              <li key={`${m.nickname}-${i}`}>
                {(() => {
                  const inner = (
                    <>
                      <Avatar nickname={m.nickname} solid={solid} size={42} icon={iconPair ? iconPair[solid ? 1 : 0] : undefined} />
                      <span className={m.role ? 'is-strong' : ''}>
                        {m.nickname}
                        {m.role && (
                          <>
                            <br />
                            {m.role}
                          </>
                        )}
                      </span>
                    </>
                  );
                  // 나를 뺀 다른 참여자는 눌러서 회원 프로필(20-1)로
                  return m.me ? (
                    inner
                  ) : (
                    <button
                      type="button"
                      className="people-link"
                      onClick={() => push({ name: 'member', nickname: m.nickname, gatheringId: g.id })}
                      aria-label={`${m.nickname} 프로필 보기`}
                    >
                      {inner}
                    </button>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={isDining ? 'privacy-card' : 'care-card'}>
        <h3 className="guidance-title">
          {isDining && <img src={shieldCheck} alt="" width={19} height={19} />}
          {isDining ? '인연에는 닉네임만 공개돼요' : '서로의 여행을 배려해요'}
        </h3>
        <p>
          {isDining
            ? '인연에는 닉네임만 공개해요. 실명·연락처 공유는 직접 동의할 때만 가능해요. 각자 결제하며 만남은 선택이에요. 불편하면 신고·차단하거나 모임을 나갈 수 있어요.'
            : '사진 촬영과 개인정보 공유는 먼저 동의를 구해요. 인연에는 닉네임만 표시하고 실명·연락처는 기본 비공개예요. 참여는 선택이며 원하면 신고·차단하거나 모임을 나갈 수 있어요. 사찰 예절을 지키고 교통비는 각자 부담해요.'}
        </p>
      </section>

      {joined || g.mine ? (
        <button type="button" className="btn-primary btn-icon" onClick={() => push({ name: 'chat', id: g.id })}>
          <img src={messageWhite} alt="" width={22} height={22} />
          모임 대화 들어가기
        </button>
      ) : (
        // //수정 closed(모집 끝) · busy(요청 중)일 때도 버튼 잠금 + 상황별 글자
        <button type="button" className="btn-primary btn-icon" onClick={joinNow} disabled={full || closed || busy}>
          {!full && !closed && <img src={messageWhite} alt="" width={22} height={22} />} {/* //추가 Figma Mobile 17 처럼 말풍선 아이콘 */}
          {closed ? '모집이 끝난 모임이에요' : full ? '모집 인원이 다 찼어요' : busy ? '들어가는 중…' : '모임 대화 들어가기'} {/* //수정 '이 모임에 참여하기' → Figma 문구. 누르면 참여 + 대화방 이동 */}
        </button>
      )}
      {g.mine && g.serverId && g.status !== 'ended' && ( // //추가 내가 만든 서버 모임이면 모임장 버튼 2개 ('모임 닫기 준비 중' 대신)
        <div className="sheet-actions">
          <button type="button" className="link-button link-center-brand" disabled={busy} onClick={() => setStatus(g.status === 'close' ? 'open' : 'close')}>
            {g.status === 'close' ? '다시 모집하기' : '모집 마감하기'} {/* //추가 지금 상태의 반대로 바꾸는 버튼 */}
          </button>
          <button type="button" className="link-button link-center-brand" disabled={busy} onClick={() => setEnding(true)}>
            모임 끝내기 {/* //추가 누르면 아래 확인 창 → ended */}
          </button>
        </div>
      )}
      {(joined || g.mine) && !(g.mine && g.serverId) && ( // //수정 서버 모임의 모임장은 위 버튼을 쓰므로 여기서 뺌 (모임장은 나갈 수 없음)
        <button type="button" className="link-button link-center-brand" onClick={() => setLeaving(true)}>
          {g.mine ? '모임 닫기' : '모임 나가기'}
        </button>
      )}

      {other && (
        <button type="button" className="link-card" onClick={() => push({ name: 'gathering', id: other.id })}>
          <img src={clover} alt="" width={22} height={22} />
          <span>
            <strong>
              {KIND_LABEL[other.kind]}도 함께 · {other.title}
            </strong>
            <small>
              {formatShort(other.date)} {other.start}–{other.end} · {other.distance === '다른 지역' ? '다른 지역' : '근처'} 모임 보기
            </small>
          </span>
          <img src={chevronRight18} alt="" width={18} height={18} />
        </button>
      )}

      {viewingMap && g.placeId && ( // //추가 보기 전용 지도 (위치를 바꾸는 버튼 없음)
        <GatheringPlaceViewer placeId={g.placeId} title={g.place} onClose={() => setViewingMap(false)} />
      )}

      {ending && ( // //추가 "모임 끝내기" 확인 창 → 확인하면 setStatus('ended')
        <ConfirmDialog
          title="모임을 끝낼까요?"
          message="끝낸 모임은 다시 열 수 없어요. 대화는 읽기만 할 수 있어요."
          confirmLabel="끝내기"
          danger
          onCancel={() => setEnding(false)}
          onConfirm={() => {
            setEnding(false);
            void setStatus('ended'); // //추가 위 setStatus → PATCH status=ended
          }}
        />
      )}

      {leaving && (
        <ConfirmDialog
          title={g.mine ? '모임을 닫을까요?' : '모임에서 나갈까요?'}
          message={g.mine ? '내가 만든 모임과 대화가 목록에서 사라져요.' : '대화방에서도 나가요. 나중에 다시 참여할 수 있어요.'}
          confirmLabel={g.mine ? '닫기' : '나가기'}
          danger
          onCancel={() => setLeaving(false)}
          // //수정 "나가기" 확인 버튼
          onConfirm={async () => {
            setLeaving(false);

            // //추가 서버 모임
            if (g.serverId) {
              if (g.mine) {
                // 모임장은 나갈 수 없어요 (서버 규칙). '모임 닫기'(모집 상태 바꾸기) API 는 아직 없어요
                showToast('모임 닫기는 아직 준비 중이에요.', 'error');
                return;
              }
              setBusy(true);
              const r = await leaveTogether(g.serverId); // DELETE /api/together/{번호}/join → 서버에서 인원 -1
              await refresh(g.serverId);                 // 줄어든 인원 · 내 참여 상태(참여 전) 다시 받기
              setBusy(false);
              showToast(r.ok ? '모임에서 나왔어요.' : r.message ?? '모임에서 나가지 못했어요.', r.ok ? 'info' : 'error');
              return;
            }

            // 예시 · 데모 모임은 기존 그대로
            world.leave(g.id);
            showToast(g.mine ? '모임을 닫았어요.' : '모임에서 나왔어요.');
            if (g.mine) reset({ name: 'connections' });
          }}
        />
      )}
    </ScreenShell>
  );
}
