/**
 * //추가 (새 파일) 모임(together) 서버 API 호출 모음
 *
 * 비유: 이 파일은 "주문서 창구"예요.
 *  - 화면(손님)이 "이 모임에 참여할래요" 라고 하면, 이 파일이 주문서를 써서 주방(Spring Boot 서버)에 넘겨요.
 *  - 주방이 결과(성공 / 실패 이유)를 돌려주면, 화면이 읽기 쉬운 모양으로 바꿔서 돌려줘요.
 *  - 실제로 DB 에 저장하는 건 주방(서버)이에요. 이 파일은 요청만 보내요.
 *
 * 들어 있는 것
 *  - createTogether  모임 만들기   POST   /api/together/write
 *  - fetchTogethers  모임 목록     GET    /api/together
 *  - fetchTogether   모임 한 개    GET    /api/together/{id}
 *  - joinTogether    모임 참여     POST   /api/together/{id}/join   (인원 +1)
 *  - leaveTogether   모임 나가기   DELETE /api/together/{id}/join   (인원 -1)
 *  - changeTogetherStatus 모집 마감 · 다시 모집 · 끝내기  PATCH /api/together/{id}/status   //추가
 *  - uploadTogetherPhotos 모임 사진 올리기               POST  /api/together/{id}/photos   //추가
 *  - toGathering     서버 모양 → 화면 모양 바꾸기 (번역기)
 *
 * ⚠️ 값은 전부 소문자예요 (meal, spot, near, other, open, close, ended, host, member).
 *    DB(PostgreSQL) enum 이 소문자라서 보내는 값과 받는 값을 소문자로 맞췄어요.
 */

// ajax: 미리 설정해 둔 axios(서버에 요청 보내는 도구).
//  - 주소 앞에 자동으로 '/api' 를 붙여요 → '/together' 라고 쓰면 실제로는 '/api/together'
//  - 로그인할 때 받은 토큰(출입증)을 요청마다 자동으로 붙여요 → 서버가 "누가 보냈는지" 알 수 있어요
import ajax from '../utils/ajax';
// errorReason: 서버가 실패로 답했을 때 { reason: 'full', message: '모임 인원이 다 찼어요.' } 를 꺼내 주는 함수.
//  서버가 꺼져 있으면 reason 이 'network' 로 와요.
import { errorReason } from './error';
// import type: "모양(타입)만" 가져와요. 실행되는 코드는 가져오지 않아요.
//  Gathering = 화면이 쓰는 모임 한 개의 모양, Member = 참여자 한 명의 모양 (lib/worldStore.tsx 에 정의)
import type { Gathering, Member } from '../lib/worldStore';

// ---------------------------------------------------------------------------
// 서버와 주고받는 값의 모양 (백엔드 DTO 와 이름이 똑같아야 해요)
// ---------------------------------------------------------------------------

/** 모임 성격: meal = 식사, spot = 관광지 (DB enum together_purpose) */
export type TogetherPurpose = 'meal' | 'spot';
/** 모임 거리: near = 근처, other = 다른 지역 (DB enum together_area) */
export type TogetherArea = 'near' | 'other';
/** 모집 상태: open = 모집 중, close = 마감, ended = 끝남 (DB enum together_status) */
export type TogetherStatus = 'open' | 'close' | 'ended';
/** 모임 안 역할: host = 모임장, member = 참여자 (DB enum together_role) */
export type TogetherRole = 'host' | 'member';

/**
 * 서버가 보내 주는 모임 한 개 (백엔드 TogetherDTO)
 * interface = "이런 칸들이 있는 서류 양식" 이라고 생각하면 돼요.
 */
export interface ServerTogether {
  id: number;                     // 모임 번호 (tbl_get_together.id)
  placeId: number | null;         // 장소 번호 (지도 연결 전이라 비어 있을 수 있음)
  togetherTitle: string;          // 제목
  togetherContent: string;        // 자세한 내용
  togetherPurpose: TogetherPurpose;
  togetherArea: TogetherArea;
  togetherMaxMember: number;      // 최대 인원 (2~6)
  togetherStartDate: string;      // 시작 시각, 예: "2026-11-10T09:00:00"
  togetherEndDate: string;        // 끝 시각
  togetherStatus: TogetherStatus;
  // 아래 세 개는 백엔드에 아직 없을 수 있어서 ? (없어도 됨) 로 표시했어요.
  //  백엔드 수정안(모임방_수정안.md 4번)을 반영하면 채워져서 와요.
  // //수정 togetherPlace → placeName
  //  백엔드 TogetherDTO 필드 이름(placeName) · DB 컬럼(tbl_get_together.place_name) 과 맞췄어요.
  //  비유: 택배 송장의 칸 이름이 보내는 쪽과 받는 쪽에서 같아야 물건이 제 칸에 들어가요.
  //       이름이 다르면 받는 쪽(서버)은 그 값을 "모르는 칸"으로 보고 버려요 → DB 에는 null 로 들어가요.
  placeName?: string | null;      // 장소 이름 (글자). 사람들이 보고 모일 곳이라 서버 · DB 에서 비우기 금지 예정
  memberCount?: number;           // 지금 인원 (모임장 포함)
  memberId?: number | null;       // 모임장 회원 번호
  coverFileId?: number | null;    // //추가 대표 사진 번호 → 목록 카드 사진 (백엔드 TogetherDTO.coverFileId 와 같은 이름)
  joined?: boolean;               // //추가 내가 참여 중인지 → 목록 카드 "참여 중" 표시 · "참여한 모임만 보기" 필터에 사용
  photoIds?: number[];            // //추가 사진 번호 전부 (상세에서만 옴) → 상세 화면 사진 줄에 사용
}

/** 서버가 보내 주는 참여자 한 명 (백엔드 TogetherMemberDTO). 본명은 없고 닉네임(memberAlias)만 있어요 */
export interface ServerTogetherMember {
  id: number;            // 참여 기록 번호
  togetherId: number;    // 어느 모임인지
  memberId: number;      // 누구인지 (회원 번호)
  togetherRole: TogetherRole;
  memberAlias: string;   // 닉네임
}

/** 모임 만들기(POST /api/together/write)에 보내는 값. 키 이름이 TogetherDTO 필드 이름과 같아야 값이 들어가요 */
export interface CreateTogetherRequest {
  togetherTitle: string;
  togetherContent: string;
  togetherPurpose: TogetherPurpose;
  togetherArea: TogetherArea;
  togetherMaxMember: number;
  placeId?: number | null; // [지도] //수정 주석 해제 : 지도에서 고른 장소 번호(POST /api/places 로 받음) → tbl_get_together.place_id → 참여자가 지도로 확인
  // //수정 togetherPlace → placeName (백엔드 TogetherDTO 의 placeName 칸으로 들어가요)
  placeName: string;
  togetherStartDate: string;      // //추가 모이는 시작 시각 "2026-12-01T19:00:00" → DB together_start_date (전에는 서버가 now() 로 고정)
  togetherEndDate: string;        // //추가 끝나는 시각 → DB together_end_date · 이 시간이 지나면 스케줄러가 '끝난 모임' 으로 바꿈
}

/** 실패했을 때 돌려주는 모양. reason 으로 상황을 나누고, message 는 화면에 그대로 보여 줄 문구 */
type Fail = { ok: false; reason: string; message: string | null };

/** 오류 → Fail 모양으로 바꾸기 (아래 함수들이 똑같이 쓰는 부분을 한 곳에 모음) */
function fail(error: unknown): Fail {
  const e = errorReason(error);
  return { ok: false, reason: e.reason, message: e.message };
}

/**
 * 화면에서 서버 모임 id 앞에 붙이는 글자.
 * 비유: 같은 "3번" 이라도 예시 모임('sample-…')·데모 모임('gather-…')과 헷갈리지 않게 붙이는 이름표예요.
 *  서버 3번 모임 → 화면 id 'srv-3'
 */
export const SERVER_PREFIX = 'srv-';

// ---------------------------------------------------------------------------
// 서버 호출 함수들
//  async/await: 서버 답을 "기다렸다가" 다음 줄을 실행해요 (택배를 받아야 뜯을 수 있는 것처럼)
//  try/catch:   서버가 실패로 답하거나 꺼져 있으면 catch 로 넘어와요 → 화면이 멈추지 않게 Fail 로 돌려줘요
//  결과는 항상 { ok: true, ... } 또는 { ok: false, reason, message } 두 가지 중 하나예요
// ---------------------------------------------------------------------------

/** 모임 만들기 → 성공하면 새 모임 번호(togetherId) */
export async function createTogether(req: CreateTogetherRequest): Promise<{ ok: true; togetherId: number } | Fail> {
  try {
    const { data } = await ajax.post('/together/write', req); // req 가 JSON 으로 바뀌어 body 에 실려 가요
    return { ok: true, togetherId: (data as { togetherId: number }).togetherId };
  } catch (error) {
    return fail(error);
  }
}

/** 모임 목록 */
export async function fetchTogethers(): Promise<{ ok: true; list: ServerTogether[] } | Fail> {
  try {
    const { data } = await ajax.get('/together');
    return { ok: true, list: data as ServerTogether[] };
  } catch (error) {
    return fail(error);
  }
}

/** 모임 한 개 + 참여자 목록 → { together, members } */
export async function fetchTogether(
  id: number,
): Promise<{ ok: true; together: ServerTogether; members: ServerTogetherMember[] } | Fail> {
  try {
    const { data } = await ajax.get(`/together/${id}`); // 백틱(`)과 ${} : 글자 안에 값을 끼워 넣기 → '/together/3'
    const d = data as { together: ServerTogether; members: ServerTogetherMember[] };
    return { ok: true, together: d.together, members: d.members ?? [] };
  } catch (error) {
    return fail(error);
  }
}

/**
 * 모임 참여 (인원 +1)
 * 실패 reason: already_joined(이미 참여) · full(꽉 참) · not_open(모집 중 아님) · not_found(없는 모임)
 */
export async function joinTogether(id: number): Promise<{ ok: true; memberCount: number | null } | Fail> {
  try {
    const { data } = await ajax.post(`/together/${id}/join`);
    return { ok: true, memberCount: (data as { memberCount?: number })?.memberCount ?? null };
  } catch (error) {
    return fail(error);
  }
}

/**
 * 모임 나가기 (인원 -1)
 * 주소는 참여와 같고 방식만 DELETE → "내 참여 기록을 지워 주세요" 라는 뜻
 * 실패 reason: host_cannot_leave(모임장은 못 나감) · not_joined(참여 안 한 모임)
 */
export async function leaveTogether(id: number): Promise<{ ok: true; memberCount: number | null } | Fail> {
  try {
    const { data } = await ajax.delete(`/together/${id}/join`);
    return { ok: true, memberCount: (data as { memberCount?: number })?.memberCount ?? null };
  } catch (error) {
    return fail(error);
  }
}

export const photoUrl = (fileId: number) => `/api/files/${fileId}`; // //추가 사진 번호 → 사진 주소. FileController 가 로그인 없이 보여 줌 → <img src> 에 그대로

export async function changeTogetherStatus(id: number, togetherStatus: TogetherStatus): Promise<{ ok: true } | Fail> { // //추가 모집 마감 · 다시 모집 · 끝내기 (모임장만) → 상세 화면 모임장 버튼. 실패 reason: not_host · ended
  try {
    await ajax.patch(`/together/${id}/status`, { togetherStatus }); // //추가 TogetherApiController.changeStatus 로 감 → DB together_status 변경
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadTogetherPhotos(id: number, photos: Blob[]): Promise<{ ok: true; photoIds: number[] } | Fail> { // //추가 사진 올리기 (모임장만, 10장까지) → 모임 만들기 직후 GatheringCreate 가 부름
  const form = new FormData(); // //추가 파일을 담아 보내는 봉투 (JSON 이 아니라 multipart)
  photos.forEach((p, i) => form.append('files', p, `photo-${i + 1}.jpg`)); // //추가 사진을 한 장씩 같은 이름(files)으로 넣음 → 서버에서 List 로 받음
  try {
    const { data } = await ajax.post(`/together/${id}/photos`, form); // //추가 FormData 를 넣으면 axios 가 multipart 로 보내 줌
    return { ok: true, photoIds: (data as { photoIds: number[] }).photoIds };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// 번역기: 서버 모양 → 화면 모양
// ---------------------------------------------------------------------------

/**
 * 서버 모임(ServerTogether) → 화면 모임(Gathering)
 *
 * 비유: 서버는 영어 이름표(meal, near)를 쓰고 화면은 한국어 이름표(dining, '근처')를 써요.
 *       이 함수가 중간에서 통역해 줘요. 화면 코드는 원래 쓰던 Gathering 모양 그대로 쓰면 돼요.
 *
 * @param t       서버가 보내 준 모임
 * @param myId    로그인한 내 회원 번호 (모임장이 나인지 판단, 참여자 목록에서 나를 빼기 위해)
 * @param members 참여자 목록 (상세 조회일 때만 있음. 목록 조회는 빈 배열)
 *
 * 참여자 목록에서 '나'를 빼는 이유:
 *  모임 상세 화면(GatheringDetail)이 '나'를 따로 그려 넣어요. 빼지 않으면 내가 두 번 보여요.
 */
export function toGathering(t: ServerTogether, myId: number | null, members: ServerTogetherMember[] = []): Gathering {
  // "2026-11-10T09:00:00" 에서 글자를 잘라 쓰기
  //  slice(0, 10)  → "2026-11-10" (날짜)
  //  slice(11, 16) → "09:00"      (시:분)
  const start = t.togetherStartDate?.slice(11, 16) ?? '';
  const end = t.togetherEndDate?.slice(11, 16) ?? '';
  // //수정 t.togetherPlace → t.placeName
  //  || : 앞의 값이 비어 있으면(null · undefined · '') 뒤의 값을 써요 → 서버가 장소를 안 보내도 화면이 깨지지 않게
  const place = t.placeName || '장소 미정';

  // 참여자 목록 → 화면 참여자 모양. 나는 빼고, 모임장(host)에는 '모임장' 표시
  const others: Member[] = members
    .filter((m) => m.memberId !== myId)
    .map((m) => ({ nickname: m.memberAlias, role: m.togetherRole === 'host' ? '모임장' : undefined }));

  // 지금 인원: 서버가 세어 준 값(memberCount)이 있으면 그걸 쓰고,
  //  없으면(백엔드 미반영) 참여자 목록 길이로 대신해요
  const count = t.memberCount ?? members.length;

  // 모임장이 나인지: 서버가 모임장 번호(memberId)를 주면 그걸로,
  //  없으면 참여자 목록에서 host 인 사람의 번호로 판단
  const hostId = t.memberId ?? members.find((m) => m.togetherRole === 'host')?.memberId ?? null;

  return {
    id: `${SERVER_PREFIX}${t.id}`,
    server: true,
    serverId: t.id,
    count,
    status: t.togetherStatus,
    kind: t.togetherPurpose === 'meal' ? 'dining' : 'sightseeing',
    distance: t.togetherArea === 'near' ? '근처' : '다른 지역',
    title: t.togetherTitle,
    description: t.togetherContent,
    date: t.togetherStartDate?.slice(0, 10) ?? '',
    start,
    end,
    place,
    placeId: t.placeId, // [지도] //수정 주석 해제 : 모임장이 정한 장소 번호 → 상세 화면 "지도로 확인해보아요"
    placeDetail: '직접 입력한 장소',
    meetNote: `${start} ${place}에서 만나요.`,
    maxPeople: t.togetherMaxMember,
    photo: t.coverFileId ? photoUrl(t.coverFileId) : undefined, // //추가 대표 사진 → 카드 · 상세 맨 위 큰 사진 (gatheringPhoto 가 그대로 씀)
    photos: t.photoIds?.map(photoUrl), // //추가 사진 전부 → 상세 화면 사진 줄
    members: others,
    mine: myId !== null && hostId === myId,
    // 지도 위 핀 위치(0~100%). 아직 좌표가 없어서 모임 번호로 계산해 고르게 흩어 놓아요
    //  % 는 "나눈 나머지" → 0~59 사이 값이 나와서 20~79% 위치에 찍혀요
    x: 20 + ((t.id * 37) % 60),
    y: 20 + ((t.id * 53) % 60),
  };
}
