import { useCallback, useEffect, useState } from 'react';
import { fetchProfile } from '../api/profile';
import { ScreenShell } from '../components/ScreenShell';
import { BottomNav } from '../components/TripParts';
import { ProfileInfoLines, toVisibility, type Visibility } from '../components/ProfileInfo';
import { FriendButton, useFriendsChanged } from '../components/FriendParts';
import { Avatar } from '../components/WorldParts';
import { bookOpen, chevronRight20 } from '../components/icons';
import { useAppState } from '../lib/appState';
import { Route, useNav } from '../lib/navigation';
import { getMemberProfile, MemberPost } from '../lib/members';
import { getSessionUser } from '../lib/session';
import { Gathering, useWorld } from '../lib/worldStore';
import { gatheringPhoto } from './GatheringDetail';

type Post = MemberPost & { gatheringId?: string };

/** 화면에 그리는 회원 정보 (서버 값 또는 예시 데이터) */
interface MemberView {
  nickname: string;
  /** 사진 주소 또는 'initial'(닉네임 첫 글자) */
  avatar: string;
  /** 서버 회원 id (예시 회원이면 null) */
  memberId: number | null;
  /** 실명 · 연락처: 나에게 보이지 않으면 visibility 가 private 이고 값은 null */
  name: string | null;
  nameVisibility: Visibility;
  phone: string | null;
  phoneVisibility: Visibility;
  bio: string;
  tastes: string[];
  tasteNote: string;
  /** 예시 데이터로 채운 모집글 */
  samplePosts: MemberPost[];
  /** 서버 회원이 아니라 예시 데이터면 true */
  demo: boolean;
  fromFigma: boolean;
}

type Load =
  | { state: 'loading' }
  | { state: 'ready'; view: MemberView }
  | { state: 'error'; message: string };

function dotDate(iso: string) {
  return iso.replace(/-/g, '.');
}

function demoView(nickname: string): MemberView {
  const p = getMemberProfile(nickname);
  return {
    nickname: p.nickname,
    avatar: 'initial',
    memberId: null,
    name: null,
    nameVisibility: 'private',
    phone: null,
    phoneVisibility: 'private',
    bio: p.intro,
    tastes: p.tastes,
    tasteNote: p.tasteNote,
    samplePosts: p.written,
    demo: true,
    fromFigma: p.fromFigma,
  };
}

/**
 * Mobile 20-1 회원 프로필 (Figma 359:701) — 다른 회원이 보는 프로필
 *  - memberId 가 있으면 GET /api/profile/{memberId} 로 불러온다. 내 id 면 내 프로필(MyProfile)로 바꿔 준다
 *  - nickname 만 있으면 예시 데이터 (모임 화면이 아직 회원 id 를 모르기 때문)
 *  - 상단 정보 창은 내 프로필과 같은 모양: 사진 · 닉네임 / 실명 · 연락처 (공개한 경우만, 아니면 '비공개') / 소개
 * 친구 신청 · 신고 · 차단은 서버가 없어 테스트 동작으로만 표시한다.
 */
export function MemberProfile({ route }: { route: Extract<Route, { name: 'member' }> }) {
  const { back, canGoBack, reset, replace, push } = useNav();
  const { showToast } = useAppState();
  const memberId = route.memberId;
  const mine = memberId != null && getSessionUser()?.id === memberId;

  const [load, setLoad] = useState<Load>(() =>
    memberId == null ? { state: 'ready', view: demoView(route.nickname ?? '여백 회원') } : { state: 'loading' },
  );

  // 친구 신청 · 수락 · 끊기 뒤에 다시 불러와서 공개 범위(친구만)를 바로 반영한다
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useFriendsChanged(reload);

  useEffect(() => {
    if (mine) {
      replace({ name: 'profile' });
      return undefined;
    }
    if (memberId == null) return undefined;
    let cancelled = false;
    // 다시 불러올 때는 화면을 비우지 않고 지금 내용을 둔 채로 바꾼다
    setLoad((prev) => (reloadKey > 0 && prev.state === 'ready' ? prev : { state: 'loading' }));
    void fetchProfile(memberId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoad({
          state: 'error',
          message: result.reason === 'not_found' ? '회원을 찾지 못했어요.' : result.message ?? '프로필을 불러오지 못했어요.',
        });
        return;
      }
      const p = result.profile;
      setLoad({
        state: 'ready',
        view: {
          nickname: p.alias || '여백 회원',
          avatar: p.avatarUrl ?? 'initial',
          memberId: p.id,
          name: p.name,
          nameVisibility: toVisibility(p.nameVisibility),
          phone: p.phone,
          phoneVisibility: toVisibility(p.phoneVisibility),
          bio: p.bio ?? '',
          tastes: p.preferences ?? [],
          tasteNote: p.vibes?.length ? p.vibes.join(' / ') : '아직 여행 키워드를 고르지 않았어요.',
          samplePosts: [],
          demo: false,
          fromFigma: false,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [memberId, mine, replace, reloadKey]);

  if (mine) return null;

  const report = () => showToast('신고 기능은 서버 연결 후 제공돼요. 지금은 접수되지 않아요.');

  return (
    <ScreenShell
      frame="Mobile 20-1 Member Profile"
      tone="brand"
      title="프로필"
      onBack={canGoBack ? back : () => reset({ name: 'connections' })}
      menu={[
        { label: '신고하기 (연결 필요)', onSelect: report },
        { label: '차단하기 (연결 필요)', onSelect: () => showToast('차단 기능은 서버 연결 후 제공돼요. 지금은 적용되지 않아요.') },
      ]}
      contentClassName="member-content"
      bottomNav={<BottomNav active="connections" />}
    >
      {load.state === 'loading' && (
        <p className="member-loading" role="status">
          프로필을 불러오는 중…
        </p>
      )}
      {load.state === 'error' && (
        <p className="profile-load-error" role="alert">
          {load.message}
        </p>
      )}
      {load.state === 'ready' && <MemberBody view={load.view} onOpen={(id) => push({ name: 'gathering', id })} />}
    </ScreenShell>
  );
}

function MemberBody({ view, onOpen }: { view: MemberView; onOpen: (gatheringId: string) => void }) {
  const world = useWorld();

  // 이 기기의 모임 목록에서 이 회원이 모임장인 모임 (Figma 회원은 그려진 모집글 그대로)
  const hosted: Post[] = view.fromFigma
    ? []
    : world.gatherings
        .filter((g) => g.members.some((m) => m.nickname === view.nickname && m.role === '모임장'))
        .map((g: Gathering) => {
          const count = world.memberCount(g);
          return {
            id: g.id,
            gatheringId: g.id,
            title: g.title,
            meta: `${dotDate(g.date)} · ${g.start}–${g.end} · ${count < g.maxPeople ? `${g.maxPeople - count}명 모집` : `${g.maxPeople}명`}`,
            status: (count < g.maxPeople ? 'open' : 'closed') as Post['status'],
            photo: gatheringPhoto(g),
            photoAlt: g.place,
          };
        });
  // 참여한 모집글은 개인 정보라 프로필에 보여 주지 않는다 (2026-10-31 피드백) — 직접 작성한 모집글만
  const written: Post[] = [...hosted, ...view.samplePosts];

  return (
    <>
      {/* 내 프로필과 같은 정보 창: 사진 · 닉네임 / 실명 · 연락처 (공개한 경우만) / 소개 */}
      <section className="profile-head member-profile-head">
        <Avatar nickname={view.nickname} avatar={view.avatar} size={70} />
        <div>
          <h2>{view.nickname}</h2>
          <ProfileInfoLines
            nameVisibility={view.nameVisibility}
            name={view.name}
            phoneVisibility={view.phoneVisibility}
            phone={view.phone}
            bio={view.bio}
            emptyBio="아직 소개를 적지 않았어요."
          />
        </div>
        <FriendButton memberId={view.memberId} nickname={view.nickname} />
      </section>

      <section className="member-taste" aria-labelledby="member-taste-title">
        <h3 id="member-taste-title">여행 취향</h3>
        {view.tastes.length > 0 && (
          <ul className="member-chips">
            {view.tastes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <p>{view.tasteNote}</p>
      </section>

      {/* 내 프로필의 수첩과 같은 모양: 제목 · 안내 · 카드 (없으면 점선 칸) */}
      <section className="member-notes" aria-labelledby="member-posts-title">
        <div className="section-row notebook-head">
          <h2 id="member-posts-title" className="guidance-title">
            <img src={bookOpen} alt="" width={24} height={24} />
            모집글
          </h2>
          <span>{written.length}개</span>
        </div>
        <p className="notebook-lead">직접 작성한 여행 모집글이에요.</p>

        {written.length === 0 && <p className="empty-day">아직 작성한 모집글이 없어요.</p>}

        {written.map((p) => (
          <article key={p.id} className={`notebook-card ${p.status === 'closed' ? 'is-closed' : ''}`}>
            {p.photo ? (
              <img className="notebook-photo" src={p.photo} alt={p.photoAlt} />
            ) : (
              <span className="notebook-photo destination-placeholder">{p.photoAlt}</span>
            )}
            <span className="chip chip-soft">{p.status === 'open' ? '모집 중' : '모집 완료'}</span>
            <h3>{p.title}</h3>
            <p className="notebook-meta">{p.meta}</p>
            {p.gatheringId && (
              <button type="button" className="row-link" onClick={() => onOpen(p.gatheringId as string)}>
                모집글 보기
                <img src={chevronRight20} alt="" width={20} height={20} />
              </button>
            )}
          </article>
        ))}

        {view.demo && !view.fromFigma && <p className="footnote">예시 회원 정보예요. 서버 연결 후 실제 회원 정보로 바뀌어요.</p>}
        {!view.demo && <p className="footnote">모집글은 모임 API 연결 후 실제 목록으로 바뀌어요.</p>}
      </section>
    </>
  );
}
