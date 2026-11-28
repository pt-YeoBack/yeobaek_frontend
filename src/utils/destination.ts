/**
 * 목적지 · 출발지 이름 → 서버 id 표
 *
 * ⚠ 임시값입니다. 나중에 GET /api/destination/list 로 교체할 예정입니다.
 *   교체할 때는 이 파일 안쪽(표와 두 함수)만 바꾸면 됩니다. 다른 코드는 destinationIdOf / departureIdOf 만 씁니다.
 *
 * 값은 DB 에서 확인해서 채웁니다. null 이면 "아직 모르는 id" 라서 저장할 수 없습니다.
 */
import type { Destination } from '../lib/destinations';

/** 목적지: lib/destinations.ts 의 Destination.id(슬러그) → tbl 목적지 id */
const DESTINATION_IDS: Record<string, number | null> = {
  tokyo: 7,
  osaka: 8,
  fukuoka: 19,
  taipei: 20,
  danang: 9,
  bangkok: 21,
  paris: 22,
  jeju: 6,
  busan: 5,
  gangneung: 16,
  gyeongju: 17,
  yeosu: 18,
};

/** 출발지: lib/destinations.ts 의 DEPARTURE_COUNTRIES 이름 → tbl 출발지 id */
const DEPARTURE_IDS: Record<string, number | null> = {
  대한민국: 1,
  일본: 2,
  미국: 13,
  중국: 14,
  대만: 10,
  기타: 15,
};

/** 목적지 서버 id. 표에 없거나(직접 입력한 'custom:…' 포함) 아직 TODO 이면 null */
export function destinationIdOf(destination: Destination | null): number | null {
  if (!destination) return null;
  return DESTINATION_IDS[destination.id] ?? null;
}

/** 출발지 서버 id. 표에 없거나 아직 TODO 이면 null */
export function departureIdOf(name: string): number | null {
  return DEPARTURE_IDS[name] ?? null;
}
