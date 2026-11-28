/**
 * Spring Boot FriendAPIController(/api/friends) 호출 모음
 *  나는 언제나 로그인한 회원이고, 상대는 회원 id(memberId)로 보낸다
 */
import ajax from '../utils/ajax';
import { errorReason } from './error';

/** 보는 사람(나) 기준의 관계: 없음 · 내가 신청함 · 나에게 신청함 · 친구 */
export type FriendState = 'none' | 'requested' | 'received' | 'friend';

/** 백엔드 FriendDTO 와 같은 모양 (응답 전용) */
export interface FriendDTO {
  memberId: number;
  /** 목록에서만 온다 */
  alias?: string | null;
  avatarUrl?: string | null;
  state: FriendState;
  /** 신청 목록이면 신청한 시각, 친구 목록이면 친구가 된 시각 (YYYY-MM-DDTHH:mm:ss) */
  since?: string | null;
}

type Fail = { ok: false; reason: string; message: string | null };
export type FriendResult = { ok: true; friend: FriendDTO } | Fail;
export type FriendListResult = { ok: true; list: FriendDTO[] } | Fail;

async function one(request: () => Promise<{ data: unknown }>): Promise<FriendResult> {
  try {
    const { data } = await request();
    return { ok: true, friend: data as FriendDTO };
  } catch (error) {
    const e = errorReason(error);
    return { ok: false, reason: e.reason, message: e.message };
  }
}

async function list(request: () => Promise<{ data: unknown }>): Promise<FriendListResult> {
  try {
    const { data } = await request();
    return { ok: true, list: (data as FriendDTO[]) ?? [] };
  } catch (error) {
    const e = errorReason(error);
    return { ok: false, reason: e.reason, message: e.message };
  }
}

/** GET /api/friends — 내 친구 목록 */
export const fetchFriends = () => list(() => ajax.get('/friends'));

/** GET /api/friends/requests?box=received|sent — 받은(기본) · 보낸 친구 신청 */
export const fetchFriendRequests = (box: 'received' | 'sent' = 'received') =>
  list(() => ajax.get('/friends/requests', { params: { box } }));

/** GET /api/friends/requests/count — 받은 친구 신청 수 (실패하면 0) */
export async function fetchFriendRequestCount(): Promise<number> {
  try {
    const { data } = await ajax.get('/friends/requests/count');
    return Number((data as { count?: number })?.count ?? 0);
  } catch {
    return 0;
  }
}

/** GET /api/friends/search?keyword= — 닉네임으로 회원 찾기 (나 제외, 나와의 관계 state 포함, 최대 20명) */
export const searchMembers = (keyword: string) => list(() => ajax.get('/friends/search', { params: { keyword } }));

/** GET /api/friends/{memberId} — 이 회원과 나의 관계 */
export const fetchFriendState = (memberId: number) => one(() => ajax.get(`/friends/${memberId}`));

/** POST /api/friends/{memberId} — 친구 신청 (상대가 이미 나에게 신청했으면 바로 친구) */
export const requestFriend = (memberId: number) => one(() => ajax.post(`/friends/${memberId}`));

/** POST /api/friends/{memberId}/accept — 받은 신청 수락 */
export const acceptFriend = (memberId: number) => one(() => ajax.post(`/friends/${memberId}/accept`));

/** DELETE /api/friends/{memberId} — 신청 취소 · 거절 · 친구 끊기 */
export const removeFriend = (memberId: number) => one(() => ajax.delete(`/friends/${memberId}`));

/** 다른 화면(알림 · 친구 목록 · 회원 프로필)에 관계가 바뀌었다고 알린다 */
export const FRIENDS_CHANGED = 'yeobaek:friends-changed';
export function notifyFriendsChanged() {
  window.dispatchEvent(new Event(FRIENDS_CHANGED));
}
