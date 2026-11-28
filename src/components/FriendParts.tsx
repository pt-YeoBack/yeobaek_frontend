import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  acceptFriend,
  fetchFriendRequests,
  fetchFriendState,
  FRIENDS_CHANGED,
  FriendDTO,
  FriendResult,
  FriendState,
  notifyFriendsChanged,
  removeFriend,
  requestFriend,
} from '../api/friends';
import { useAppState } from '../lib/appState';
import { useNav } from '../lib/navigation';
import { BottomSheet, ConfirmDialog } from './TripParts';
import { Avatar } from './WorldParts';

/** 친구 관계가 바뀌면(다른 화면에서 수락 · 삭제 등) 다시 불러온다 */
export function useFriendsChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(FRIENDS_CHANGED, reload);
    return () => window.removeEventListener(FRIENDS_CHANGED, reload);
  }, [reload]);
}

/** '2026-11-22T10:30:00' → '2026.11.22' */
export function sinceDate(since?: string | null) {
  return since ? since.slice(0, 10).replace(/-/g, '.') : '';
}

// ---------------------------------------------------------------------------
// 회원 프로필의 친구 버튼
// ---------------------------------------------------------------------------

const BUTTON_TEXT: Record<FriendState, string> = {
  none: '친구 신청',
  requested: '신청함',
  received: '수락하기',
  friend: '친구 ✓',
};

/**
 * 회원 프로필(20-1) 오른쪽 위 버튼 — 서버의 친구 관계에 따라 바뀐다
 *  none → 친구 신청 / requested → 신청함(누르면 취소 확인) / received → 수락하기 / friend → 친구 ✓(누르면 끊기 확인)
 * 예시 회원(memberId 없음)은 서버 회원이 아니라서 신청할 수 없다.
 */
export function FriendButton({ memberId, nickname }: { memberId: number | null; nickname: string }) {
  const { showToast } = useAppState();
  const [state, setState] = useState<FriendState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'unfriend' | null>(null);

  const load = useCallback(async () => {
    if (memberId == null) return;
    const result = await fetchFriendState(memberId);
    if (result.ok) setState(result.friend.state);
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);
  useFriendsChanged(load);

  const run = async (action: (id: number) => Promise<FriendResult>, done: (s: FriendState) => string) => {
    if (memberId == null || busy) return;
    setBusy(true);
    const result = await action(memberId);
    setBusy(false);
    if (result.ok) {
      setState(result.friend.state);
      showToast(done(result.friend.state), 'success');
      notifyFriendsChanged();
    } else {
      showToast(result.message ?? '친구 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      void load();
    }
  };

  if (memberId == null) {
    return (
      <button type="button" className="member-friend" onClick={() => showToast('예시 회원이라 친구 신청을 할 수 없어요.')}>
        친구 신청
      </button>
    );
  }

  const onClick = () => {
    if (state === 'none') {
      void run(requestFriend, (s) => (s === 'friend' ? `${nickname}님과 친구가 되었어요.` : `${nickname}님에게 친구 신청을 보냈어요.`));
    } else if (state === 'received') {
      void run(acceptFriend, () => `${nickname}님과 친구가 되었어요.`);
    } else if (state === 'requested') {
      setConfirm('cancel');
    } else if (state === 'friend') {
      setConfirm('unfriend');
    }
  };

  return (
    <>
      <button
        type="button"
        className={`member-friend ${state === 'requested' || state === 'friend' ? 'is-requested' : ''}`}
        aria-pressed={state === 'requested' || state === 'friend'}
        disabled={state === null || busy}
        onClick={onClick}
      >
        {state === null ? '…' : BUTTON_TEXT[state]}
      </button>
      {confirm && (
        <ConfirmDialog
          title={confirm === 'cancel' ? '친구 신청을 취소할까요?' : '친구를 끊을까요?'}
          message={confirm === 'cancel' ? `${nickname}님에게 보낸 신청이 사라져요.` : `${nickname}님과의 친구 관계가 사라져요. 다시 신청할 수 있어요.`}
          confirmLabel={confirm === 'cancel' ? '신청 취소' : '친구 끊기'}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const kind = confirm;
            setConfirm(null);
            void run(removeFriend, () => (kind === 'cancel' ? '친구 신청을 취소했어요.' : '친구를 끊었어요.'));
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 목록 한 줄 (받은 신청 · 친구)
// ---------------------------------------------------------------------------

/**
 * 친구 · 신청 목록의 한 줄. 닉네임을 누르면 회원 프로필로 간다.
 * actions 는 오른쪽 버튼들 (수락 · 거절 · 끊기)
 */
export function FriendRow({ friend, note, actions }: { friend: FriendDTO; note: string; actions?: ReactNode }) {
  const { push } = useNav();
  const nickname = friend.alias || '여백 회원';
  return (
    <li className="friend-row">
      <button type="button" className="friend-who" onClick={() => push({ name: 'member', memberId: friend.memberId })}>
        <Avatar nickname={nickname} avatar={friend.avatarUrl ?? 'initial'} size={40} />
        <span>
          <strong>{nickname}</strong>
          <small>{note}</small>
        </span>
      </button>
      {actions && <span className="friend-actions">{actions}</span>}
    </li>
  );
}

/**
 * 받은 친구 신청 목록 + 수락 · 거절 (알림 시트와 친구 화면이 같이 쓴다)
 * 처리한 신청은 목록에서 빠지고, 다른 화면에 관계가 바뀌었다고 알린다.
 */
export function ReceivedRequests({ emptyText }: { emptyText: string }) {
  const { showToast } = useAppState();
  const [list, setList] = useState<FriendDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const result = await fetchFriendRequests('received');
    if (result.ok) {
      setList(result.list);
      setError(null);
    } else {
      setError(result.message ?? '친구 신청을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useFriendsChanged(load);

  const handle = async (f: FriendDTO, accept: boolean) => {
    setBusyId(f.memberId);
    const result = accept ? await acceptFriend(f.memberId) : await removeFriend(f.memberId);
    setBusyId(null);
    if (!result.ok) {
      showToast(result.message ?? '친구 신청을 처리하지 못했어요.');
      return;
    }
    showToast(accept ? `${f.alias || '여백 회원'}님과 친구가 되었어요.` : '친구 신청을 거절했어요.', accept ? 'success' : undefined);
    notifyFriendsChanged();
  };

  if (error) return <p className="profile-load-error" role="alert">{error}</p>;
  if (list === null) return <p className="member-loading" role="status">불러오는 중…</p>;
  if (list.length === 0) return <p className="empty-day">{emptyText}</p>;

  return (
    <ul className="friend-list">
      {list.map((f) => (
        <FriendRow
          key={f.memberId}
          friend={f}
          note={`${sinceDate(f.since)} 친구 신청`}
          actions={
            <>
              <button type="button" className="friend-action is-primary" disabled={busyId === f.memberId} onClick={() => void handle(f, true)}>
                수락
              </button>
              <button type="button" className="friend-action" disabled={busyId === f.memberId} onClick={() => void handle(f, false)}>
                거절
              </button>
            </>
          }
        />
      ))}
    </ul>
  );
}

/** 상단 알림(종) 시트: 받은 친구 신청 */
export function FriendRequestSheet({ onClose }: { onClose: () => void }) {
  const { push } = useNav();
  return (
    <BottomSheet
      title="알림 · 받은 친구 신청"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            onClose();
            push({ name: 'friends' });
          }}
        >
          친구 목록 보기
        </button>
      }
    >
      <ReceivedRequests emptyText="새 알림이 없어요. 받은 친구 신청이 생기면 여기에 보여요." />
    </BottomSheet>
  );
}
