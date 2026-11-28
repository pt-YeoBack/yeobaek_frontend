// //수정 useEffect 추가: "화면이 그려진 뒤에 할 일"(여기서는 서버에서 모임 목록 받기)을 등록하는 도구
import { PointerEvent, useEffect, useRef, useState } from 'react';
// //추가 서버에서 모임 목록을 받는 함수(fetchTogethers)와, 서버 모양 → 화면 모양 번역기(toGathering)
import { fetchTogethers, SERVER_PREFIX, toGathering } from '../api/together'; // //수정 SERVER_PREFIX 추가 → 'srv-' + 번호로 참여 중 id 만들기
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav, BottomSheet } from '../components/TripParts';
import { MiniMap, Switch } from '../components/WorldParts';
import { clover, flag, mapPin22, sliders, sparkles } from '../components/icons';
import { useAppState } from '../lib/appState';
import { formatMDW } from '../lib/dates';
import { Route, useNav } from '../lib/navigation';
// [지도 시작] //추가 카카오api 넣어야함 : 지도 모듈은 src/map/index.ts 에서만 import (가이드 규칙)
// import { PlacesMap, providerForRegion } from '../map';
// [지도 끝]
// //추가 로그인할 때 저장해 둔 내 정보(회원 번호 id 포함)를 꺼내는 함수 → "모임장이 나인지" 판단용
import { getSessionUser } from '../lib/session';
import { tripDates, useTrips } from '../lib/tripStore';
import { Gathering, useWorld } from '../lib/worldStore';
import { Chatbot } from './Chatbot';

type Filter = 'all' | 'dining' | 'sightseeing';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'dining', label: '식사' },
  { key: 'sightseeing', label: '관광지' },
];

export const KIND_LABEL = { dining: '식사', sightseeing: '관광지' } as const;

/** Mobile 16 Connections · 지금의 인연 */
export function MapPage({ route }: { route: Extract<Route, { name: 'connections' }> }) {
  const { push, replace } = useNav();
  const { showToast } = useAppState();
  const { trips } = useTrips();
  // //수정 putServerGatherings 추가: 서버에서 받은 목록을 저장소(worldStore)에 넣는 함수
  const { gatherings, isJoined, memberCount, putServerGatherings } = useWorld();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [joinedOnly, setJoinedOnly] = useState(false);
  // 지도 위에 얹힌 모임 목록: 접힘(카드 하나 보임) ↔ 펼침(목록 위주)
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const area = trips[0]?.destination?.id === 'tokyo' || !trips[0] ? '시부야' : trips[0].destination?.city ?? '시부야';

  // 도우미 창이 열린 상태도 화면 기록에 남겨 새로고침·뒤로 가기 후에도 유지
  const assistantOpen = Boolean(route.assistant);
  const setAssistant = (open: boolean) => replace({ name: 'connections', assistant: open || undefined });

  // //추가 인연 화면에 들어오면 서버에서 모임 목록을 받아 저장소에 넣어요
  //  비유: 가게 문을 열면(화면이 뜨면) 먼저 창고(서버)에 "오늘 모임 뭐 있어요?" 하고 물어보는 것.
  //  - useEffect(할 일, [재료]) : 화면이 처음 뜰 때 한 번, 그리고 [재료]가 바뀔 때만 다시 실행
  //    putServerGatherings 는 바뀌지 않는 함수라서 사실상 "화면이 뜰 때 한 번" 실행돼요
  //  - .then(r => ...) : 서버 답이 오면 그때 실행할 일
  //  - 실패하면(r.ok 가 false) 아무것도 안 해요 → 예시 모임만 보이고 화면은 그대로 동작
  useEffect(() => {
    const myId = getSessionUser()?.id ?? null; // ?. : 로그인 정보가 없으면 오류 대신 undefined, ?? null : 그러면 null
    fetchTogethers().then((r) => {
      // filter: 끝난(ended) 모임은 목록에서 빼요 / map: 하나씩 화면 모양으로 번역
      if (!r.ok) return; // //수정 실패(서버 꺼짐 등)면 예시 모임만 보여 줌
      const open = r.list.filter((t) => t.togetherStatus !== 'ended'); // //수정 끝난 모임은 목록에서 빼기 (기존과 같음)
      putServerGatherings(
        open.map((t) => toGathering(t, myId)),
        open.filter((t) => t.joined).map((t) => `${SERVER_PREFIX}${t.id}`), // //추가 서버가 준 joined → 카드 "참여 중" · "참여한 모임만 보기" 가 새로고침 뒤에도 맞음
      );
    });
  }, [putServerGatherings]);

  const list = gatherings.filter((g) => (filter === 'all' || g.kind === filter) && (!joinedOnly || isJoined(g.id)));

  const open = (g: Gathering) => push({ name: 'gathering', id: g.id });

  // 손잡이를 위아래로 밀면 펼치고 접기, 그냥 누르면 토글
  const onGripDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGripMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.moved) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 24) {
      d.moved = true;
      setExpanded(dy < 0);
    }
  };
  const onGripUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setExpanded((v) => !v);
  };

  // 전체 화면 지도에서는 아래쪽이 목록에 가려지므로 핀을 지도 위쪽 부분에 모아 그린다
  const fit = (y: number) => Math.round(y * 0.5 + 6);

  return (
    <ScreenShell
      frame="Mobile 16 Connections"
      tone="brand"
      title="인연"
      subtitle="여백이 겹치는 사람들과 잠깐 함께"
      noBackSlot
      trailing={<BellButton />}
      contentClassName="connections-content"
      bottomNav={<BottomNav active="connections" />}
    >
      <div className="section-row conn-location">
        <span className="guidance-title">
          <img src={mapPin22} alt="" width={18} height={18} />
          <strong>현재 {area} · 모임 장소 기준</strong>
        </span>
        <button type="button" className="icon-button" onClick={() => setSheet(true)} aria-label="모임 필터 설정">
          <img src={sliders} alt="" width={20} height={20} />
        </button>
      </div>

      <div className={`conn-stage ${expanded ? 'is-expanded' : ''}`}>
        {/* //수정 아래 style: 목록 패널이 카카오·구글 로고, 핀, 도우미 버튼을 가리지 않게 패널 위까지만 지도 */}
        {/* [지도 시작] //추가 카카오api 넣어야함 : 켤 때 바로 아래 <MiniMap ...> 여는 태그를 이것으로 바꾸고, </MiniMap> 은 </PlacesMap> 으로
        <PlacesMap
          provider={providerForRegion(trips[0]?.destination?.region)}
          items={list.map((g) => ({ key: g.id, title: g.title, placeId: g.placeId, selected: selected === g.id }))}
          onSelect={(id) => {
            setSelected(id);
            document.getElementById(`gcard-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }}
          style={{ position: 'absolute', inset: '0 0 calc(var(--panel-peek) + 10px)', height: 'auto' }}
        >
        [지도 끝] */}
        <MiniMap
          variant="full"
          height="100%"
          stops={[
            ...list.map((g) => ({
              id: g.id,
              x: g.x,
              y: fit(g.y),
              label: `${g.title.length > 8 ? `${g.title.slice(0, 8)}…` : g.title} · ${memberCount(g)}/${g.maxPeople}`,
              kind: 'gathering' as const,
              active: selected === g.id,
              onSelect: () => {
                setSelected(g.id);
                document.getElementById(`gcard-${g.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              },
            })),
            { id: 'me', x: 62, y: fit(40), label: '현재 위치(예시)', kind: 'me' as const },
          ]}
          labels={[
            { x: 4, y: fit(4) + 6, text: '우다가와초' },
            { x: 66, y: fit(76), text: '도겐자카' },
            { x: 40, y: fit(58), text: '시부야역', tone: 'blue' },
          ]}
          onLocate={() => showToast('현재 위치는 위치 권한·지도 API 연결이 필요해요. 지금은 예시 지도예요.')}
        >
          {/* 지도 위에 떠 있는 필터 (지도 앱처럼) */}
          <div className="conn-filter-float">
            <div className="chip-row" role="tablist" aria-label="모임 종류">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`chip ${filter === f.key ? 'chip-solid' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Figma에 입구가 없어 추가: 모임 만들기 (Mobile 18 두 번째 프레임) */}
            <button type="button" className="chip chip-outline" onClick={() => push({ name: 'gatheringNew' })}>
              + 모임 만들기
            </button>
          </div>
          <button
            type="button"
            className="map-fab"
            onClick={() => setAssistant(true)}
            aria-label="여백 도우미(AI 챗봇 데모) 열기"
            aria-haspopup="dialog"
          >
            <img src={sparkles} alt="" width={24} height={24} />
          </button>
        </MiniMap>

        <section className="gathering-panel" aria-label="모임 목록">
          <button
            type="button"
            className="panel-grip-button"
            aria-expanded={expanded}
            aria-label={expanded ? '모임 목록 접기' : '모임 목록 펼치기'}
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={() => (drag.current = null)}
          >
            <span className="panel-grip" aria-hidden="true" />
            <span className="panel-count">
              모임 {list.length}개 · {expanded ? '아래로 내려 지도 보기' : '위로 올려 목록 보기'}
            </span>
          </button>
          <div className="gathering-scroll" tabIndex={0} aria-label={`모임 ${list.length}개 · 세로로 스크롤`}>
            {list.length === 0 && <p className="empty-day">조건에 맞는 모임이 없어요.</p>}
            {list.map((g) => (
              <GatheringCard
                key={g.id}
                g={g}
                count={memberCount(g)}
                joined={isJoined(g.id)}
                active={selected === g.id}
                tripDay={dayIndexOf(g, trips[0] ? tripDates(trips[0]) : [])}
                onOpen={() => open(g)}
              />
            ))}
            <p className="footnote conn-footnote">지도는 모양만 나타낸 예시예요. 지도에는 모임 장소만 표시해요. 다른 여행자의 실시간 위치는 공개하지 않아요.</p>
          </div>
        </section>
      </div>

      {assistantOpen && <Chatbot onClose={() => setAssistant(false)} />}

      {sheet && (
        <BottomSheet title="모임 보기 설정" onClose={() => setSheet(false)}>
          <Switch label="참여한 모임만 보기" checked={joinedOnly} onChange={setJoinedOnly} />
          <p className="sheet-note">거리·시간 필터는 위치 정보 연결 후 제공할 수 있어요. 지금은 예시 모임과 내가 만든 모임만 보여요.</p>
        </BottomSheet>
      )}
    </ScreenShell>
  );
}

function dayIndexOf(g: Gathering, dates: string[]): number {
  return dates.indexOf(g.date);
}

function GatheringCard({
  g,
  count,
  joined,
  active,
  tripDay,
  onOpen,
}: {
  g: Gathering;
  count: number;
  joined: boolean;
  active: boolean;
  tripDay: number;
  onOpen: () => void;
}) {
  const names = g.members.map((m) => m.nickname);
  return (
    <button type="button" id={`gcard-${g.id}`} className={`gathering-card ${active ? 'is-active' : ''}`} onClick={onOpen}>
      <span className="gathering-tags">
        <img src={flag} alt="" width={17} height={17} />
        <img src={clover} alt="" width={18} height={18} />
        <span className="chip">
          {KIND_LABEL[g.kind]} · {g.distance}
        </span>
        <span className="gathering-count">
          {count} / {g.maxPeople}명
        </span>
        {joined && <span className="chip chip-solid chip-mini">참여 중</span>}
        {g.sample && <span className="sample-badge">예시</span>}
        {g.mine && <span className="sample-badge">내 모임</span>}
      </span>
      <strong className="gathering-title">{g.title}</strong>
      <span className="gathering-lines">
        {formatMDW(g.date)} {g.start}–{g.end} · {tripDay >= 0 ? `내 여행 Day ${tripDay + 1}` : '내 여행 기간 밖'}
        <br />
        {g.place} · {g.placeDetail}
        <br />
        {names.length ? names.join('·') : '아직 참여자가 없어요'}
      </span>
    </button>
  );
}
