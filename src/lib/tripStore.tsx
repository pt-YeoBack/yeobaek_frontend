/**
 * 여행 데이터 저장소
 * - 저장된 여행 · 작성 중인 여행(초안) 모두 메모리에만 보관 (새로고침하면 사라짐)
 * - localStorage 저장은 제거했다.
 * - 새 여행을 saveDraft() 로 저장하면 서버(POST /api/trip/create)에도 한 번에 저장하고, 응답의 id 를 serverId 로 보관한다.
 *   아직 연결하지 않은 것: 서버에서 목록 불러오기, 저장된 여행 수정(update) · 삭제 — 이 둘은 지금처럼 화면(메모리)에만 반영된다.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { dateRange, ISODate } from './dates';
import type { Destination, Region } from './destinations';
import { createTrip, MissingIdError, tripToCreateRequest } from '../api/trips';
import type { TripDTO } from '../api/trips';

export interface Companion {
  id: string;
  name: string;
  relation: string; // '선택 안 함' 포함
}

export interface Activity {
  id: string;
  time: string; // HH:MM
  place: string;
  memo: string;
  /** Mobile 13·14에서 좋아요로 추가한 추천 장소 */
  source?: 'ai';
  /** 추천 장소 id (nearby.ts) — 사진·카테고리 표시용 */
  placeId?: string;
  /** 다음 일정까지의 이동 메모 (Mobile 12 카드 아래 작은 글씨) */
  note?: string;
  /** 서버에 저장된 일정 id (schedules[].id) */
  serverId?: number;
}

export interface DayPlan {
  title: string;
  activities: Activity[];
  /** Mobile 21 수첩 "오늘의 한 문장" */
  diary?: string;
  /** Mobile 21 방문 기록 체크한 활동 id */
  visited?: string[];
  /** 서버에 저장된 일차 id (days[].id) */
  serverId?: number;
}

export interface Trip {
  id: string;
  region: Region;
  destination: Destination | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  departureCountry: string;
  companions: Companion[];
  days: Record<ISODate, DayPlan>;
  /** 여행 이름 (Mobile 11·12 제목). 비어 있으면 tripTitle()이 자동으로 만든다 */
  title?: string;
  createdAt: number;
  updatedAt: number;
  savedAt?: number;
  /** 서버에 저장된 여행 id (trip.id). 없으면 아직 서버에 저장하지 않은 여행 */
  serverId?: number;
}

/** 저장 결과 — 실패하면 화면에 보여 줄 메시지를 담는다 */
export type SaveResult = { ok: true; trip: Trip } | { ok: false; message: string };

export function newId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyTrip(): Trip {
  const now = Date.now();
  return {
    id: newId('trip'),
    region: 'overseas',
    destination: null,
    startDate: null,
    endDate: null,
    departureCountry: '대한민국',
    companions: [],
    days: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Mobile 11·12의 여행 제목 — "도쿄, 우리의 5일" */
export function tripTitle(trip: Trip): string {
  if (trip.title?.trim()) return trip.title.trim();
  const city = trip.destination?.city ?? '새 여행';
  const n = tripDates(trip).length;
  return n > 0 ? `${city}, 우리의 ${n}일` : `${city} 여행`;
}

/** 나 + 동행 수 */
export function peopleCount(trip: Trip): number {
  return 1 + trip.companions.length;
}

export function tripDates(trip: Trip): ISODate[] {
  if (!trip.startDate || !trip.endDate) return [];
  return dateRange(trip.startDate, trip.endDate);
}

export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => a.time.localeCompare(b.time));
}

/** 여행 기간 밖의 날짜에 들어 있는 활동 수 (날짜를 줄일 때 경고용) */
export function activitiesOutsideRange(trip: Trip, start: ISODate, end: ISODate): number {
  return Object.entries(trip.days)
    .filter(([date]) => date < start || date > end)
    .reduce((n, [, plan]) => n + plan.activities.length, 0);
}

/**
 * create 응답의 id 를 상태에 붙인다. 서버가 요청 순서를 그대로 돌려주므로
 * days[i].schedules[j] 는 요청의 같은 위치(날짜 i · 일정 j)와 대응한다 → 인덱스로 맞춘다.
 */
function applyServerIds(trip: Trip, dates: ISODate[], server: TripDTO): Trip {
  const days = { ...trip.days };
  dates.forEach((date, i) => {
    const serverDay = server.days?.[i];
    if (!serverDay || serverDay.tripDay !== date) return;
    const plan = trip.days[date] ?? { title: '', activities: [] };
    days[date] = {
      ...plan,
      serverId: serverDay.id,
      activities: plan.activities.map((a, j) => ({ ...a, serverId: serverDay.schedules?.[j]?.id })),
    };
  });
  return { ...trip, days, serverId: server.id };
}

interface TripApi {
  trips: Trip[];
  draft: Trip | null;
  /** 새 여행 작성 시작 (작성 중인 초안이 있으면 그대로 이어감) */
  startNewTrip: (opts?: { fresh?: boolean }) => Trip;
  /** 저장된 여행을 수정하려고 초안으로 불러오기 */
  editTrip: (id: string) => Trip | null;
  updateDraft: (patch: Partial<Trip> | ((t: Trip) => Trip)) => void;
  discardDraft: () => void;
  /** 초안을 저장 목록에 반영 (기간 밖 날짜의 일정은 정리). 새 여행이면 서버에도 저장한다 */
  saveDraft: () => Promise<SaveResult>;
  deleteTrip: (id: string) => void;
  isSaved: (id: string) => boolean;
  /** 저장된 여행을 바로 고친다 (Mobile 12~15 추천 추가, Mobile 21 기록). 같은 여행을 편집 중이면 초안에도 반영 */
  updateTrip: (id: string, fn: (t: Trip) => Trip) => void;
  getTrip: (id: string | undefined) => Trip | undefined;
}

const TripContext = createContext<TripApi | null>(null);

// owner 는 App 에서 key={owner} 로 계정이 바뀔 때 Provider 를 새로 마운트하는 데 쓴다 (계정별 데이터 분리)
export function TripProvider({ children }: { owner: string | null; children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [draft, setDraft] = useState<Trip | null>(null);

  const startNewTrip = useCallback(
    (opts?: { fresh?: boolean }) => {
      if (draft && !opts?.fresh && !trips.some((t) => t.id === draft.id)) return draft;
      const t = emptyTrip();
      setDraft(t);
      return t;
    },
    [draft, trips],
  );

  const editTrip = useCallback(
    (id: string) => {
      if (draft?.id === id) return draft;
      const found = trips.find((t) => t.id === id);
      if (!found) return null;
      const copy = JSON.parse(JSON.stringify(found)) as Trip;
      setDraft(copy);
      return copy;
    },
    [draft, trips],
  );

  const updateDraft = useCallback((patch: Partial<Trip> | ((t: Trip) => Trip)) => {
    setDraft((d) => {
      const base = d ?? emptyTrip();
      const next = typeof patch === 'function' ? patch(base) : { ...base, ...patch };
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const discardDraft = useCallback(() => setDraft(null), []);

  const saveDraft = useCallback(async (): Promise<SaveResult> => {
    if (!draft || !draft.startDate || !draft.endDate) {
      return { ok: false, message: '여행 날짜를 먼저 선택해 주세요.' };
    }
    const { startDate, endDate } = draft;
    const days: Record<ISODate, DayPlan> = {};
    Object.entries(draft.days).forEach(([date, plan]) => {
      if (date >= startDate && date <= endDate) days[date] = plan;
    });
    const now = Date.now();
    let saved: Trip = { ...draft, days, savedAt: now, updatedAt: now };

    // 서버에 아직 없는 새 여행만 create 로 보낸다. 이미 서버에 저장된 여행(serverId 있음)의 수정은
    // 아직 서버에 반영하지 않고 화면(메모리)에만 저장한다 (update 연결은 다음 단계)
    if (saved.serverId === undefined) {
      const dates = tripDates(saved);
      let request;
      try {
        request = tripToCreateRequest(saved, dates, tripTitle(saved));
      } catch (e) {
        if (e instanceof MissingIdError) return { ok: false, message: e.message };
        throw e;
      }
      const result = await createTrip(request);
      if (!result.ok) {
        return { ok: false, message: result.message ?? '여행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' };
      }
      saved = applyServerIds(saved, dates, result.trip);
    }

    setTrips((list) => {
      const exists = list.some((t) => t.id === saved.id);
      return exists ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list];
    });
    setDraft(saved);
    return { ok: true, trip: saved };
  }, [draft]);

  const deleteTrip = useCallback((id: string) => {
    setTrips((list) => list.filter((t) => t.id !== id));
    setDraft((d) => (d?.id === id ? null : d));
  }, []);

  const isSaved = useCallback((id: string) => trips.some((t) => t.id === id), [trips]);

  const updateTrip = useCallback((id: string, fn: (t: Trip) => Trip) => {
    const now = Date.now();
    setTrips((list) => list.map((t) => (t.id === id ? { ...fn(t), savedAt: now, updatedAt: now } : t)));
    setDraft((d) => {
      if (!d || d.id !== id) return d;
      const wasClean = (d.updatedAt ?? 0) <= (d.savedAt ?? 0);
      const next = fn(d);
      return wasClean ? { ...next, savedAt: now, updatedAt: now } : next;
    });
  }, []);

  const getTrip = useCallback((id: string | undefined) => (id ? trips.find((t) => t.id === id) : undefined), [trips]);

  const value = useMemo(
    () => ({ trips, draft, startNewTrip, editTrip, updateDraft, discardDraft, saveDraft, deleteTrip, isSaved, updateTrip, getTrip }),
    [trips, draft, startNewTrip, editTrip, updateDraft, discardDraft, saveDraft, deleteTrip, isSaved, updateTrip, getTrip],
  );
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrips(): TripApi {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrips must be used inside TripProvider');
  return ctx;
}
