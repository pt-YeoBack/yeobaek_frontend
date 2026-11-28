import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptFriend,
  fetchFriends,
  FriendDTO,
  FriendResult,
  notifyFriendsChanged,
  removeFriend,
  requestFriend,
  searchMembers,
} from '../api/friends';
import { FriendRow, ReceivedRequests, sinceDate, useFriendsChanged } from '../components/FriendParts';
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav, ConfirmDialog } from '../components/TripParts';
import { users } from '../components/icons';
import { useAppState } from '../lib/appState';
import { useNav } from '../lib/navigation';

/**
 * 친구 목록 (프로필 > 친구 목록)
 *  - 회원 찾기: 닉네임으로 검색해서 바로 친구 신청 · 수락 (실명 · 연락처로는 찾지 않음)
 *  - 받은 친구 신청: 수락 · 거절 (상단 알림 시트와 같은 목록)
 *  - 친구: 닉네임을 누르면 회원 프로필, '끊기'로 친구 끊기
 */
export function FriendList() {
  const { back, canGoBack, reset } = useNav();
  const { showToast } = useAppState();
  const [friends, setFriends] = useState<FriendDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unfriend, setUnfriend] = useState<FriendDTO | null>(null);

  const load = useCallback(async () => {
    const result = await fetchFriends();
    if (result.ok) {
      setFriends(result.list);
      setError(null);
    } else {
      setError(result.message ?? '친구 목록을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useFriendsChanged(load);

  const confirmUnfriend = async (f: FriendDTO) => {
    setUnfriend(null);
    const result = await removeFriend(f.memberId);
    if (!result.ok) {
      showToast(result.message ?? '친구를 끊지 못했어요.');
      return;
    }
    showToast('친구를 끊었어요.');
    notifyFriendsChanged();
  };

  return (
    <ScreenShell
      frame="Friend List"
      tone="brand"
      title="친구"
      onBack={canGoBack ? back : () => reset({ name: 'profile' })}
      trailing={<BellButton />}
      contentClassName="friends-content"
      bottomNav={<BottomNav active="profile" />}
    >
      <MemberSearch />

      <section className="friend-section" aria-labelledby="friend-received-title">
        <h2 id="friend-received-title" className="guidance-title">
          받은 친구 신청
        </h2>
        <ReceivedRequests emptyText="받은 친구 신청이 없어요." />
      </section>

      <section className="friend-section" aria-labelledby="friend-list-title">
        <h2 id="friend-list-title" className="guidance-title">
          <img src={users} alt="" width={22} height={22} />
          친구 {friends ? `${friends.length}명` : ''}
        </h2>
        {error && (
          <p className="profile-load-error" role="alert">
            {error}
          </p>
        )}
        {!error && friends === null && (
          <p className="member-loading" role="status">
            불러오는 중…
          </p>
        )}
        {friends?.length === 0 && <p className="empty-day">아직 친구가 없어요. 모임에서 만난 회원의 프로필에서 친구 신청을 해 보세요.</p>}
        {friends && friends.length > 0 && (
          <ul className="friend-list">
            {friends.map((f) => (
              <FriendRow
                key={f.memberId}
                friend={f}
                note={`${sinceDate(f.since)}부터 친구`}
                actions={
                  <button type="button" className="friend-action" onClick={() => setUnfriend(f)}>
                    끊기
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {unfriend && (
        <ConfirmDialog
          title="친구를 끊을까요?"
          message={`${unfriend.alias || '여백 회원'}님과의 친구 관계가 사라져요. 다시 신청할 수 있어요.`}
          confirmLabel="친구 끊기"
          danger
          onCancel={() => setUnfriend(null)}
          onConfirm={() => void confirmUnfriend(unfriend)}
        />
      )}
    </ScreenShell>
  );
}

/**
 * 회원 찾기 — 닉네임으로 검색 (입력을 멈추고 0.3초 뒤에 찾는다)
 * 결과마다 나와의 관계에 맞는 버튼: 신청 · 신청 취소 · 수락 · 친구
 */
function MemberSearch() {
  const { showToast } = useAppState();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<FriendDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const latest = useRef(0);
  const trimmed = keyword.trim();

  const search = useCallback(async (k: string) => {
    const ticket = ++latest.current;
    const result = await searchMembers(k);
    if (ticket !== latest.current) return; // 더 새 검색이 있으면 무시
    if (result.ok) {
      setResults(result.list);
      setError(null);
    } else {
      setResults(null);
      setError(result.message ?? '회원을 찾지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }, []);

  useEffect(() => {
    if (!trimmed) {
      latest.current += 1;
      setResults(null);
      setError(null);
      return undefined;
    }
    const timer = window.setTimeout(() => void search(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [trimmed, search]);

  // 다른 곳에서 관계가 바뀌면 지금 결과의 버튼도 다시 맞춘다
  const refresh = useCallback(() => {
    if (trimmed) void search(trimmed);
  }, [trimmed, search]);
  useFriendsChanged(refresh);

  const act = async (f: FriendDTO, action: (id: number) => Promise<FriendResult>, done: string) => {
    setBusyId(f.memberId);
    const result = await action(f.memberId);
    setBusyId(null);
    if (!result.ok) {
      showToast(result.message ?? '친구 요청을 처리하지 못했어요.');
      return;
    }
    const nickname = f.alias || '여백 회원';
    showToast(result.friend.state === 'friend' ? `${nickname}님과 친구가 되었어요.` : done, 'success');
    notifyFriendsChanged();
  };

  const actionFor = (f: FriendDTO) => {
    const busy = busyId === f.memberId;
    switch (f.state) {
      case 'none':
        return (
          <button type="button" className="friend-action is-primary" disabled={busy} onClick={() => void act(f, requestFriend, '친구 신청을 보냈어요.')}>
            신청
          </button>
        );
      case 'requested':
        return (
          <button type="button" className="friend-action" disabled={busy} onClick={() => void act(f, removeFriend, '친구 신청을 취소했어요.')}>
            신청 취소
          </button>
        );
      case 'received':
        return (
          <button type="button" className="friend-action is-primary" disabled={busy} onClick={() => void act(f, acceptFriend, '친구가 되었어요.')}>
            수락
          </button>
        );
      default:
        return <span className="friend-badge">친구</span>;
    }
  };

  const NOTE: Record<FriendDTO['state'], string> = {
    none: '여백 회원',
    requested: '친구 신청을 보냈어요',
    received: '나에게 친구 신청을 보냈어요',
    friend: '친구',
  };

  return (
    <section className="friend-section" aria-labelledby="friend-search-title">
      <h2 id="friend-search-title" className="guidance-title">
        회원 찾기
      </h2>
      <input
        className="soft-input"
        type="search"
        value={keyword}
        maxLength={12}
        placeholder="닉네임으로 찾기"
        aria-label="닉네임으로 회원 찾기"
        onChange={(e) => setKeyword(e.target.value)}
      />
      {error && (
        <p className="profile-load-error" role="alert">
          {error}
        </p>
      )}
      {trimmed && results?.length === 0 && <p className="empty-day">'{trimmed}' 닉네임의 회원이 없어요.</p>}
      {results && results.length > 0 && (
        <ul className="friend-list">
          {results.map((f) => (
            <FriendRow key={f.memberId} friend={f} note={NOTE[f.state]} actions={actionFor(f)} />
          ))}
        </ul>
      )}
    </section>
  );
}
