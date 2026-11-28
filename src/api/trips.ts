/**
 * Spring Boot 여행 API(/api/trip) 호출 모음
 *  지금은 create(새 여행 한 번에 저장)만 연결했다. 나머지 API 는 타입만 미리 정의해 둔다.
 *  값은 모두 소문자: tripCategory "domestic" | "overseas", tripStatus "write" | "save" | "finish"
 */
import { departureIdOf, destinationIdOf } from '../utils/destination';
import ajax from '../utils/ajax';
import type { ISODate } from '../lib/dates';
import type { Trip } from '../lib/tripStore';
import { errorReason } from './error';

// ---------------------------------------------------------------------------
// 서버 응답 모양 (list · detail · create 응답 공용)
// ---------------------------------------------------------------------------

export interface ScheduleDTO {
  id: number;
  tripDayId: number;
  memberId?: number;
  placeId?: number | null;
  scheduleTitle: string;
  /** 'YYYY-MM-DDTHH:mm:ss' */
  scheduleStartTime: string;
  scheduleMemo?: string | null;
  scheduleAiSource?: boolean | null;
}

export interface TripDayDTO {
  id: number;
  tripId: number;
  tripDay: ISODate;
  tripDayTitle?: string | null;
  schedules: ScheduleDTO[];
}

export interface CompanionDTO {
  id: number;
  tripId: number;
  memberId?: number | null;
  companionIsMember: boolean;
  companionName: string;
  companionContact?: string | null;
  /** 서버의 신청 상태값(pending/done/reject). 화면의 '관계'와 다르다 */
  companionRelation?: string | null;
}

export interface TripDTO {
  id: number;
  memberId: number;
  destinationId: number;
  departureId: number;
  tripCategory: 'domestic' | 'overseas';
  tripTitle: string;
  tripStartDate: ISODate;
  tripEndDate: ISODate;
  tripStatus: 'write' | 'save' | 'finish';
  days: TripDayDTO[];
  companions: CompanionDTO[];
}

// ---------------------------------------------------------------------------
// POST /api/trip/create
// ---------------------------------------------------------------------------

export interface TripCreateRequest {
  destinationId: number;
  departureId: number;
  tripCategory: 'domestic' | 'overseas';
  tripTitle: string;
  tripStartDate: ISODate;
  tripEndDate: ISODate;
  companions: { companionIsMember: boolean; companionName: string }[];
  days: {
    tripDay: ISODate;
    tripDayTitle: string;
    schedules: { scheduleTitle: string; scheduleStartTime: string; scheduleMemo?: string }[];
  }[];
}

export interface TripCreateResponse {
  message: string;
  trip: TripDTO;
}

type Fail = { ok: false; reason: string; message: string | null };
export type CreateTripResult = { ok: true; trip: TripDTO } | Fail;

/** 목적지 · 출발지 id 를 못 구하면(표가 TODO 이거나 직접 입력한 여행지) 서버로 보내지 않는다 */
export class MissingIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingIdError';
  }
}

/**
 * 프론트 Trip → create 요청 본문. 서버로 보내는 모양 변환은 모두 여기서 한다.
 *  - title: tripStore 의 tripTitle(trip) 값 (여행 이름이 비어 있으면 자동 생성된 제목). 순환 import 를 피하려고 인자로 받는다
 *  - days: 기간 안의 모든 날짜를 보낸다 (일정이 없는 날도 일차 id 를 받기 위해). 기간 밖 날짜는 뺀다
 *  - schedules: 상태에 저장된 순서 그대로 보낸다 (응답 id 를 같은 인덱스로 맞추기 때문에 정렬하지 않는다)
 *  - 보내지 않는 것: tripStatus(서버가 write 로 시작), companionContact(생략), 동행 relation,
 *    diary · visited · note · source · placeId (화면에만 보관)
 */
export function tripToCreateRequest(trip: Trip, dates: ISODate[], title: string): TripCreateRequest {
  const destinationId = destinationIdOf(trip.destination);
  if (destinationId === null) {
    throw new MissingIdError(
      trip.destination?.id.startsWith('custom:')
        ? '직접 입력한 여행지는 아직 서버에 저장할 수 없어요. 목록에서 선택해 주세요.'
        : '이 여행지는 아직 서버에 등록되지 않아 저장할 수 없어요.',
    );
  }
  const departureId = departureIdOf(trip.departureCountry);
  if (departureId === null) {
    throw new MissingIdError('출발 국가를 서버에서 찾지 못했어요.');
  }
  if (!trip.startDate || !trip.endDate) {
    throw new MissingIdError('여행 날짜를 먼저 선택해 주세요.');
  }

  return {
    destinationId,
    departureId,
    tripCategory: trip.region,
    tripTitle: title,
    tripStartDate: trip.startDate,
    tripEndDate: trip.endDate,
    companions: trip.companions.map((c) => ({ companionIsMember: false, companionName: c.name.trim() })),
    days: dates.map((date) => {
      const plan = trip.days[date];
      return {
        tripDay: date,
        tripDayTitle: plan?.title ?? '',
        schedules: (plan?.activities ?? []).map((a) => {
          const memo = a.memo.trim();
          return {
            scheduleTitle: a.place,
            // 시간 미입력 시 기본값: 그 일차 날짜 00:00 (화면에서는 시간이 필수라 보통 값이 있다)
            scheduleStartTime: `${date}T${a.time ? `${a.time}:00` : '00:00:00'}`,
            // 메모가 비어 있으면 필드를 생략해 서버에 null 로 저장되게 한다
            ...(memo ? { scheduleMemo: memo } : {}),
          };
        }),
      };
    }),
  };
}

/** POST /api/trip/create — 여행 · 일차 · 일정 · 동행을 한 번에 저장. 응답에 서버가 만든 id 가 들어 있다 */
export async function createTrip(req: TripCreateRequest): Promise<CreateTripResult> {
  try {
    const { data } = await ajax.post('/trip/create', req);
    return { ok: true, trip: (data as TripCreateResponse).trip };
  } catch (error) {
    const e = errorReason(error);
    return { ok: false, reason: e.reason, message: e.message };
  }
}
