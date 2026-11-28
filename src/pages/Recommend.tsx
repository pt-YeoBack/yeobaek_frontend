
import { PointerEvent, useEffect, useRef, useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav } from '../components/TripParts';
import { MapStop, MiniMap } from '../components/WorldParts';
import { useAppState } from '../lib/appState';
import { formatMDW } from '../lib/dates';
import { Route, useNav } from '../lib/navigation';
import { isDemoArea } from '../lib/nearby';
import { useRecommend } from '../hooks/useRecommend';
import { tripDates } from '../lib/tripStore';

/** 기존 일정 핀 위치 (실제 지도 좌표 아님) */
const STOP_POS: [number, number][] = [
  [44, 86],
  [70, 66],
  [80, 30],
  [40, 34],
  [22, 58],
  [56, 14],
  [30, 12],
  [62, 50],
];

/** Mobile 13 · 여행 일정 확인 */
export function Recommend({
  route,
}: {
  route: Extract<Route, { name: 'nearby' }>;
}) {
  const { back, canGoBack, reset, push, replace } = useNav();
  const { showToast } = useAppState();

  const n = useRecommend(route.tripId, route.day);

  // 인연 화면과 같은 하단 패널 동작
  const [expanded, setExpanded] = useState(false);

  // 오늘 일정 미리보기 카드 펼침 상태
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // 미리보기 카드를 누르면 일정 내용을 펼치거나 접기
  const togglePreview = () => {
  
    // 하단 패널도 함께 펼쳐 내용이 가려지지 않도록 처리
  if (!expanded) {
    setExpanded(true);
    setPreviewExpanded(true);
    return;
  }

  setPreviewExpanded((prev) => !prev);
};

  const drag = useRef<{
    y: number;
    moved: boolean;
  } | null>(null);

  // 날짜 선택 드롭다운 상태
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  // 여행 데이터가 없으면 일정 목록으로 이동
  useEffect(() => {
    if (!n.trip) {
      reset({ name: 'schedules' });
    }
  }, [n.trip, reset]);

  if (!n.trip) return null;

  const trip = n.trip;
  const city = trip.destination?.city ?? '여행지';

  // 해당 여행의 전체 날짜 목록
  const dates = tripDates(trip);

  // 선택한 날짜로 지도 화면 전환
  const changeDay = (date: string) => {
    setDateMenuOpen(false);

    // 현재 날짜를 다시 선택하면 이동하지 않음
    if (date === route.day) return;

    // 다른 날짜로 변경하면 일정 미리보기 접기
    setPreviewExpanded(false);

    // 하단 패널도 기본 상태로 복귀
    setExpanded(false);

    // 같은 지도 화면에서 날짜만 변경
    replace({
      name: 'nearby',
      tripId: trip.id,
      day: date,
    });
  };

  // 하단 패널에 가리지 않도록 지도 핀을 상단에 배치
  const fit = (y: number) => Math.round(y * 0.5 + 6);

  const stops: MapStop[] = [
    ...n.activities
      .slice(0, STOP_POS.length)
      .map((a, i) => ({
        id: a.id,
        x: STOP_POS[i][0],
        y: fit(STOP_POS[i][1]),
        label:
          a.place.length > 9
            ? `${a.place.slice(0, 9)}…`
            : a.place,
        kind: 'stop' as const,
        num: i + 1,
      })),
    {
      id: 'me',
      x: 66,
      y: fit(46),
      label: '여백 시작 위치 (예시)',
      kind: 'me' as const,
    },
  ];

  // 인연 화면과 동일한 드래그 처리 방식
  const onGripDown = (
    e: PointerEvent<HTMLButtonElement>
  ) => {
    drag.current = {
      y: e.clientY,
      moved: false,
    };

    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onGripMove = (
    e: PointerEvent<HTMLButtonElement>
  ) => {
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

    // 드래그하지 않고 누른 경우 열기/닫기
    if (d && !d.moved) {
      setExpanded((v) => !v);
    }
  };

  const goToAIRecommend = () => {
    push({
      name: 'suggestions',
      tripId: trip.id,
      day: route.day,
    });
  };

  return (
    <ScreenShell
      frame="Mobile 13 AI Nearby Recommendations"
      tone="brand"
      title="여행 일정 확인"
      subtitle="오늘의 여행 동선을 확인해 보세요"
      onBack={
        canGoBack
          ? back
          : () => reset({ name: 'schedules' })
      }
      trailing={<BellButton />}
      contentClassName="nearby-content"
      bottomNav={<BottomNav active="schedule" />}
    >
      {/* 인연 화면의 conn-stage와 같은 구성 */}
      <div
        className={`recommend-stage ${
          expanded ? 'is-expanded' : ''
        }`}
      >
        {/* 1. 전체 크기 지도 */}
        <MiniMap
          variant="full"
          height="100%"
          route
          stops={stops}
          labels={
            isDemoArea(trip)
              ? [
                  {
                    x: 6,
                    y: 8,
                    text: '예시 지도',
                    tone: 'blue',
                  },
                  {
                    x: 62,
                    y: 12,
                    text: '미야시타 공원',
                    tone: 'blue',
                  },
                  {
                    x: 78,
                    y: 45,
                    text: '시부야역',
                    tone: 'blue',
                  },
                ]
              : []
          }
          onLocate={() =>
            showToast(
              '현재 위치는 위치 권한 및 지도 API 연결이 필요해요. 지금은 예시 지도예요.'
            )
          }
        >


{/* 지도 위 날짜 선택 위젯 */}
<div className="recommend-location recommend-date-picker">
  <button
    type="button"
    className="recommend-date-trigger"
    aria-expanded={dateMenuOpen}
    aria-controls="recommend-date-options"
    onClick={() => setDateMenuOpen((prev) => !prev)}
  >
    <span className="recommend-date-info">
      <strong>
        {city} · {formatMDW(route.day)}
      </strong>
      <small>오늘의 여행 동선</small>
    </span>

<span className="recommend-date-arrow" aria-hidden="true">
  {dateMenuOpen ? '▲' : '▼'}
</span>
  </button>

  {/* 날짜 선택 메뉴 */}
  {dateMenuOpen && (
    <div
      id="recommend-date-options"
      className="recommend-date-options"
      aria-label="여행 날짜 선택"
    >
      {dates.map((date, index) => (
        <button
          key={date}
          type="button"
          className={`recommend-date-option ${
            date === route.day ? 'is-selected' : ''
          }`}
          aria-current={
            date === route.day ? 'date' : undefined
          }
          onClick={() => changeDay(date)}
        >
          <span>
            Day {index + 1} · {formatMDW(date)}
          </span>

          {date === route.day && (
            <span aria-hidden="true">✓</span>
          )}
        </button>
      ))}
    </div>
  )}
</div>

        </MiniMap>

        {/* 2. 지도 위 슬라이드 패널 */}
        <section
          className="recommend-panel"
          aria-label="오늘 일정 및 AI 추천"
        >
          {/* 패널 손잡이 */}
          <button
            type="button"
            className="recommend-panel-grip-button"
            aria-expanded={expanded}
            aria-controls="recommend-panel-scroll"
            aria-label={
              expanded
                ? '일정 패널 접기'
                : '일정 패널 펼치기'
            }
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onClick={(e) => {
              // 키보드로 실행한 클릭도 지원
              if (e.detail === 0) {
                setExpanded((v) => !v);
              }
            }}
          >
            <span
              className="recommend-panel-grip"
              aria-hidden="true"
            />

            <span className="recommend-panel-count">
              {expanded
                ? '아래로 내려 지도 보기'
                : '위로 올려 일정 보기'}
            </span>
          </button>

          {/* 3. 패널 내부 스크롤 */}
          <div
            id="recommend-panel-scroll"
            className="recommend-panel-scroll"
            tabIndex={0}
            aria-label="오늘 일정 및 AI 추천 내용"
          >
 
{/* 오늘 일정 미리보기 - 클릭하면 펼쳐지는 카드 */}
<section
  className={`preview-card recommend-preview ${
    previewExpanded ? 'is-open' : ''
  }`}
  aria-labelledby="preview-title"
>
  <button
    type="button"
    className="recommend-preview-toggle"
    onClick={togglePreview}
    aria-expanded={previewExpanded}
    aria-controls="recommend-preview-details"
  >
    <span className="recommend-preview-heading">
      <strong id="preview-title">
        오늘 일정 미리보기
      </strong>
    </span>

    <span className="recommend-preview-summary">
      {n.activities.length === 0
        ? '아직 이 날의 일정이 없어요.'
        : `오늘 등록된 일정 ${n.activities.length}개`}
    </span>

    {!previewExpanded && n.activities.length > 0 && (
      <span className="recommend-preview-first">
        {n.activities[0].time} · {n.activities[0].place}
      </span>
    )}
  </button>

  {/* 클릭하면 펼쳐지는 상세 내용 */}
  {previewExpanded && (
    <div
      id="recommend-preview-details"
      className="recommend-preview-details"
    >
      {n.activities.length > 0 ? (
        <ol>
          {n.activities.map((a) => (
            <li key={a.id}>
              <span className="preview-time">
                {a.time}
              </span>

              <span>
                <strong>{a.place}</strong>

                <small>
                  {a.source === 'ai'
                    ? 'AI 추천 · 좋아요로 추가됨'
                    : a.memo || '직접 작성한 일정'}
                </small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="recommend-preview-empty">
          아직 등록된 일정이 없습니다.
          <br />
          아래 AI 추천 기능을 이용해
          여행의 빈 시간을 채워보세요.
        </p>
      )}
    </div>
  )}
</section>
            {/* 4. AI 추천 위젯 */}
            <section className="nearby-ai-entry">
              <div className="nearby-ai-entry-heading">
                <span
                  className="nearby-ai-entry-icon"
                  aria-hidden="true"
                >
                  ✦
                </span>

                <h2>빈 여백을 AI가 채워줘요</h2>
              </div>

              <p className="nearby-ai-entry-description">
                오늘 일정의 빈 시간에 들를 만한
                근처 장소를 추천받아 보세요.
              </p>

              <button
                type="button"
                className="nearby-ai-entry-button"
                onClick={goToAIRecommend}
              >
                AI 추천받기
              </button>
            </section>
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}
