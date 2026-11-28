/**
 * Mobile 13~22 데이터 (프론트엔드 데모)
 * - 프로필·취향·공개 설정, 근처 추천 취향, 인연 모임·참여·대화
 * - 메모리에만 보관 (새로고침하면 사라짐). localStorage 저장은 제거했다.
 *
 * ⚠️ 서버가 없어서 다른 여행자는 실제 사람이 아닌 Figma에 그려진 예시 참여자입니다.
 *    모임 참여·대화도 이 브라우저 안에서만 기록되고, 다른 사람에게 전달되지 않습니다.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { addDays, ISODate } from './dates';
import { DEFAULT_PREFS, NearbyPrefs } from './nearby';
import { newId } from './tripStore';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface Profile {
  nickname: string;
  intro: string;
  /** 'initial' = 닉네임 첫 글자, 'puppy' = Figma 예시 캐릭터, 그 외 data URL(직접 올린 사진) */
  avatar: string;
  tastes: string[];
  keywords: string[];
  privacy: { nickname: boolean; contact: boolean; autosave: boolean };
  /** Mobile 22 컬러 조합 선택: 팔레트 id(lib/accent.ts) 또는 직접 고른 #rrggbb */
  accent?: string;
}

export type GatheringKind = 'dining' | 'sightseeing';

export interface Member {
  nickname: string;
  role?: string; // '모임장' 등
  icon?: 'sun' | 'camera' | 'cloud' | 'footprints' | 'heart';
}

export interface Gathering {
  id: string;
  kind: GatheringKind;
  /** "근처" / "다른 지역" */
  distance: '근처' | '다른 지역';
  title: string;
  description: string;
  date: ISODate;
  start: string;
  end: string;
  place: string;
  placeDetail: string;
  meetNote: string;
  extraNote?: string;
  maxPeople: number;
  members: Member[];
  photo?: string; // 'sushi' | 'asakusa' | data URL
  photos?: string[]; // //추가 서버 모임 사진 주소 전부 (/api/files/번호) → 상세 화면 사진 줄 · api/together.ts toGathering 이 채움
  /** Figma에 그려진 예시 모임이면 true */
  sample?: boolean;
  /** 내가 만든 모임이면 true (내가 모임장) */
  mine?: boolean;
  /** 지도 위 위치 (0~100 %) */
  x: number;
  y: number;

  // //추가 서버(DB)에 저장된 모임일 때만 채워지는 칸들 (예시 · 데모 모임은 비어 있음)
  //  ? 는 "없어도 되는 칸" 이라는 뜻이에요. 그래서 기존 예시 모임 코드는 고칠 필요가 없어요.
  /** //추가 서버 모임이면 true. 이때 id 는 'srv-<번호>' (api/together.ts 의 SERVER_PREFIX) */
  server?: boolean;
  /** //추가 서버 모임 번호 (tbl_get_together.id). 서버에 요청 보낼 때 이 번호를 써요 */
  serverId?: number;
  placeId?: number | null; // [지도] //수정 주석 해제 : 지도에 핀을 찍을 장소 번호 (tbl_place.id) → 없으면 장소 이름만 있는 모임
  /** //추가 서버가 세어 준 지금 인원 (모임장 포함). 화면의 "4 / 6명" 의 4 */
  count?: number;
  /** //추가 서버 모집 상태: open(모집 중) · close(마감) · ended(끝남) */
  status?: 'open' | 'close' | 'ended';
}

export interface ChatMessage {
  id: string;
  author: string; // 닉네임, 나는 '__me'
  role?: string;
  text: string;
  time: string; // HH:MM
}

interface WorldData {
  profile: Profile;
  prefs: NearbyPrefs;
  /** 추천 화면에서 싫어요로 숨긴 장소 (여행·날짜별) */
  dismissed: Record<string, string[]>;
  /** "2개 더 보기"를 누른 여행·날짜 */
  expanded: Record<string, boolean>;
  createdGatherings: Gathering[];
  /**
   * //추가 서버에서 받아 온 모임들
   *  비유: 서버(DB)가 "원본 장부"라면, 이건 화면에 보여 주려고 잠깐 베껴 둔 "메모"예요.
   *  새로고침하면 사라지지만, 화면에 들어올 때마다 서버에서 다시 받아 와요.
   */
  serverGatherings: Gathering[];
  joined: string[];
  chats: Record<string, ChatMessage[]>;
  /** 대화 기록을 직접 지운 모임 */
  archiveDeleted: string[];
  /** Mobile 16 ✦ 버튼 — 여백 도우미(챗봇 데모) 대화 기록 */
  assistantLog: AssistantMessage[];
  /** Mobile 20-1 친구 신청(테스트) — 이 기기에만 기록, 상대에게 전달되지 않음 */
  friendRequests: string[];
}

export interface AssistantAction {
  label: string;
  /** 누르면 이동할 화면 (navigation Route와 같은 모양) */
  route: { name: string; [k: string]: unknown };
}

export interface AssistantMessage {
  id: string;
  from: 'me' | 'bot';
  text: string;
  time: string;
  actions?: AssistantAction[];
}

// ---------------------------------------------------------------------------
// Figma 예시 모임 (Mobile 16~19 · 21 · 22)
// ---------------------------------------------------------------------------

/** 예시 모임 날짜는 첫 여행의 1·2일차에 맞춘다 (여행이 없으면 Figma 날짜 2026-11-09) */
export function sampleGatherings(baseDate: ISODate | null): Gathering[] {
  const d1 = baseDate ?? '2026-11-09';
  return [
    {
      id: 'sample-sushi',
      kind: 'dining',
      distance: '근처',
      title: '시부야에서 초밥 한 끼',
      description: '오늘 저녁, 각자의 여행 이야기를 나눠요.',
      date: d1,
      start: '19:00',
      end: '20:00',
      place: '우오베이 시부야 도겐자카점',
      placeDetail: '2-29-11 도겐자카 · 도보 약 10분',
      meetNote: '18:50 식당 입구에서 만나요.',
      extraNote: '사용자 고정 저녁 약속 · 식당 예약 확약 아님\n식당 입구에서 함께 만나요.',
      maxPeople: 6,
      members: [
        { nickname: '초밥산책', role: '모임장' },
        { nickname: '도쿄한바퀴' },
        { nickname: '느린 발걸음' },
      ],
      photo: 'sushi',
      sample: true,
      x: 26,
      y: 52,
    },
    {
      id: 'sample-asakusa',
      kind: 'sightseeing',
      distance: '다른 지역',
      title: '아사쿠사 아침 산책',
      description: '사람이 적은 아침, 천천히 걸어요.',
      date: addDays(d1, 1),
      start: '09:00',
      end: '10:00',
      place: '가미나리몬 앞',
      placeDetail: '시부야에서 지하철 약 40분',
      meetNote: '08:50 가미나리몬 앞에서 만나요.',
      maxPeople: 6,
      members: [
        { nickname: '아침빛', role: '모임장', icon: 'sun' },
        { nickname: '골목사진가', icon: 'camera' },
        { nickname: '구름여행', icon: 'cloud' },
        { nickname: '느린 발걸음', icon: 'heart' },
      ],
      photo: 'asakusa',
      sample: true,
      x: 60,
      y: 14,
    },
    // Figma에는 카드가 2장뿐이라, 같은 템플릿으로 예시 모임 2개를 더 넣었습니다 (임의 추가)
    {
      id: 'sample-cafe',
      kind: 'dining',
      distance: '근처',
      title: '시부야 골목 카페 한 잔',
      description: '오후의 여백에 조용한 카페에서 쉬어 가요.',
      date: addDays(d1, 2),
      start: '15:00',
      end: '16:00',
      place: '시부야 오쿠시부 카페 거리',
      placeDetail: '시부야역에서 도보 약 12분',
      meetNote: '14:50 카페 거리 입구에서 만나요.',
      extraNote: '각자 주문 · 예약 없음\n자리가 없으면 근처 카페로 옮겨요.',
      maxPeople: 4,
      members: [
        { nickname: '라테한모금', role: '모임장' },
        { nickname: '오후산책' },
      ],
      photo: 'cafe',
      sample: true,
      x: 18,
      y: 30,
    },
    {
      id: 'sample-skytree',
      kind: 'sightseeing',
      distance: '다른 지역',
      title: '스미다강 스카이트리 노을 산책',
      description: '강을 따라 걸으며 노을과 스카이트리를 봐요.',
      date: addDays(d1, 3),
      start: '17:00',
      end: '18:30',
      place: '아사쿠사역 4번 출구',
      placeDetail: '시부야에서 지하철 약 35분',
      meetNote: '16:50 아사쿠사역 4번 출구에서 만나요.',
      maxPeople: 6,
      members: [
        { nickname: '노을수집가', role: '모임장', icon: 'sun' },
        { nickname: '강변러너', icon: 'footprints' },
        { nickname: '필름한롤', icon: 'camera' },
      ],
      photo: 'tokyo',
      sample: true,
      x: 50,
      y: 82,
    },
  ];
}

/** Figma Mobile 19의 대화 (예시 참여자 메시지) */
const SAMPLE_CHATS: Record<string, ChatMessage[]> = {
  'sample-sushi': [
    { id: 's1', author: '초밥산책', role: '모임장', text: '안녕하세요!\n저녁 7시 쯤 우오베이 도겐자카점 입구에서 만나요.', time: '18:12' },
    { id: 's2', author: '도쿄한바퀴', text: '저도 근처예요. 입구에서 같이 만나요.', time: '18:16' },
    { id: 's3', author: '느린 발걸음', text: '반가워요! 식사 비용은 각자 주문한 만큼 계산하면 될까요?', time: '18:18' },
    { id: 's4', author: '초밥산책', role: '모임장', text: '네, 각자 계산해요. 천천히 오세요!', time: '18:19' },
  ],
  'sample-asakusa': [
    { id: 'a1', author: '아침빛', role: '모임장', text: '안녕하세요! 내일 08:50에 가미나리몬 앞에서 만나요.', time: '21:02' },
    { id: 'a2', author: '골목사진가', text: '사진 찍을 때는 먼저 물어볼게요!', time: '21:05' },
  ],
};

export const TASTE_OPTIONS = [
  '힐링', '풍경', '식도락', '디저트', '물멍', '로컬', '카페', '쇼핑', '휴양', '캠핑', '축제', '가성비',
  '어드벤처', '팝업', '공연', '호캉스', '자연', '사진', '기념품', '숙소', '가족', '커플', '친구', '나홀로',
];

export const KEYWORD_OPTIONS = [
  '평온한', '계획적인', '평화로운', '활발한', '여유로운', '재밌는', '무계획의', '회복되는', '조용한',
  '나즈막한', '체계적인', '가벼운', '로컬적인', '활기찬', '체험하는',
];

function defaultWorld(): WorldData {
  return {
    // 서버(GET /api/profile)에서 받기 전의 값. 서버 기본값(tbl_member_setting default)과 맞춘다
    profile: {
      nickname: '',
      intro: '',
      avatar: 'initial',
      tastes: [],
      keywords: [],
      privacy: { nickname: true, contact: true, autosave: true },
      accent: 'sky',
    },
    prefs: DEFAULT_PREFS,
    dismissed: {},
    expanded: {},
    createdGatherings: [],
    serverGatherings: [], // //추가 처음에는 비어 있음 (인연 화면에 들어가면 서버에서 채움)
    joined: [],
    chats: {},
    archiveDeleted: [],
    assistantLog: [],
    friendRequests: [],
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface WorldApi extends WorldData {
  gatherings: Gathering[];
  getGathering: (id: string) => Gathering | undefined;
  isJoined: (id: string) => boolean;
  /** 화면에 보여 줄 참여 인원 (예시 참여자 + 나) */
  memberCount: (g: Gathering) => number;
  messagesOf: (id: string) => ChatMessage[];
  updateProfile: (patch: Partial<Profile>) => void;
  setPrefs: (p: NearbyPrefs) => void;
  dismissPlace: (key: string, placeId: string) => void;
  restorePlaces: (key: string) => void;
  setExpanded: (key: string, v: boolean) => void;
  join: (id: string) => void;
  leave: (id: string) => void;
  createGathering: (g: Omit<Gathering, 'id' | 'members' | 'mine' | 'x' | 'y'>) => Gathering;
  /** //추가 서버 모임 목록을 통째로 바꿔 넣기 (인연 화면에 들어올 때) */
  putServerGatherings: (list: Gathering[], joinedIds?: string[]) => void; // //수정 joinedIds 추가 → 목록에서 받은 "참여 중" 을 저장소에 반영
  /** //추가 서버 모임 하나를 넣거나 바꾸고, 내가 참여 중인지(joined)도 서버 값으로 맞추기 (상세 화면) */
  putServerGathering: (g: Gathering, joined: boolean) => void;
  sendMessage: (id: string, text: string) => void;
  deleteArchive: (id: string) => void;
  addAssistant: (msgs: AssistantMessage[]) => void;
  clearAssistant: () => void;
  toggleFriendRequest: (nickname: string) => boolean;
}

const WorldContext = createContext<WorldApi | null>(null);

export function WorldProvider({
  baseDate,
  children,
}: {
  owner: string | null;
  /** 예시 모임 날짜 기준 (첫 여행 시작일) */
  baseDate: ISODate | null;
  children: ReactNode;
}) {
  // owner 가 바뀌면 App 에서 key={owner} 로 새로 마운트되어 빈 데이터로 시작한다
  const [data, setData] = useState<WorldData>(defaultWorld);

  // //수정 서버 모임을 맨 앞에 붙임 → 목록 = 서버 모임 + 내가 만든 데모 모임 + 예시 모임
  //  useMemo: 재료(의존성 배열)가 바뀔 때만 다시 계산하고, 아니면 전에 만든 목록을 재사용해요
  const gatherings = useMemo(
    () => [...data.serverGatherings, ...data.createdGatherings, ...sampleGatherings(baseDate)],
    [data.serverGatherings, data.createdGatherings, baseDate],
  );

  const getGathering = useCallback((id: string) => gatherings.find((g) => g.id === id), [gatherings]);
  const isJoined = useCallback((id: string) => data.joined.includes(id), [data.joined]);
  // //수정 인원 수 계산
  //  - 서버 모임: 서버가 세어 준 숫자(count)를 그대로 써요. 화면이 직접 세지 않아요.
  //    (비유: 출석부 원본은 서버에 있고, 화면은 "몇 명이에요?" 라고 물어본 답을 그대로 읽어요)
  //  - 예시 · 데모 모임: 원래 하던 대로 "예시 참여자 수 + 나" 로 계산
  const memberCount = useCallback(
    (g: Gathering) =>
      g.server
        ? g.count ?? 0
        : g.members.length + (data.joined.includes(g.id) && !g.mine ? 1 : 0) + (g.mine ? 1 : 0),
    [data.joined],
  );
  const messagesOf = useCallback(
    (id: string) => [...(SAMPLE_CHATS[id] ?? []), ...(data.chats[id] ?? [])],
    [data.chats],
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } })),
    [],
  );
  const setPrefs = useCallback((prefs: NearbyPrefs) => setData((d) => ({ ...d, prefs })), []);
  const dismissPlace = useCallback(
    (k: string, placeId: string) =>
      setData((d) => ({ ...d, dismissed: { ...d.dismissed, [k]: [...(d.dismissed[k] ?? []), placeId] } })),
    [],
  );
  const restorePlaces = useCallback((k: string) => setData((d) => ({ ...d, dismissed: { ...d.dismissed, [k]: [] } })), []);
  const setExpanded = useCallback(
    (k: string, v: boolean) => setData((d) => ({ ...d, expanded: { ...d.expanded, [k]: v } })),
    [],
  );
  const join = useCallback(
    (id: string) => setData((d) => (d.joined.includes(id) ? d : { ...d, joined: [...d.joined, id] })),
    [],
  );
  const leave = useCallback(
    (id: string) =>
      setData((d) => ({
        ...d,
        joined: d.joined.filter((x) => x !== id),
        createdGatherings: d.createdGatherings.filter((g) => g.id !== id),
      })),
    [],
  );
  const createGathering = useCallback((g: Omit<Gathering, 'id' | 'members' | 'mine' | 'x' | 'y'>) => {
    const created: Gathering = {
      ...g,
      id: newId('gather'),
      members: [],
      mine: true,
      x: 35 + Math.round(Math.random() * 30),
      y: 30 + Math.round(Math.random() * 40),
    };
    setData((d) => ({ ...d, createdGatherings: [created, ...d.createdGatherings], joined: [...d.joined, created.id] }));
    return created;
  }, []);

  // //추가 서버 모임 목록을 통째로 바꿔 넣기
  //  setData((d) => ({ ...d, 바꿀칸: 새값 })) 모양은 "기존 데이터(d)를 그대로 복사(...d)하고 한 칸만 바꾼다" 는 뜻이에요.
  //  React 는 값이 '새 객체'로 바뀌어야 화면을 다시 그려서, 원본을 직접 고치지 않고 복사본을 만들어요.
  const putServerGatherings = useCallback(
    (list: Gathering[], joinedIds?: string[]) => // //수정 joinedIds = 서버가 "참여 중" 이라고 알려 준 모임 id ('srv-3' 모양)
      setData((d) => ({
        ...d,
        serverGatherings: list,
        joined: joinedIds // //추가 받았으면 서버 모임('srv-')의 참여 여부만 서버 값으로 바꿔 끼움 → 예시 모임 참여 기록은 그대로
          ? [...d.joined.filter((x) => !x.startsWith('srv-')), ...joinedIds]
          : d.joined,
      })),
    [],
  );

  // //추가 서버 모임 하나를 넣거나 바꾸기 + 내가 참여 중인지 맞추기
  //  - 이미 있는 모임(같은 id)이면 새 정보로 바꿔 끼우고, 없으면 맨 앞에 넣어요
  //  - joined 가 true 면 내 참여 목록에 id 를 넣고, false 면 빼요
  //    (new Set: 같은 값이 두 번 들어가지 않게 중복을 없애 주는 상자)
  const putServerGathering = useCallback(
    (g: Gathering, joined: boolean) =>
      setData((d) => {
        const exists = d.serverGatherings.some((x) => x.id === g.id);
        return {
          ...d,
          serverGatherings: exists ? d.serverGatherings.map((x) => (x.id === g.id ? g : x)) : [g, ...d.serverGatherings],
          joined: joined ? [...new Set([...d.joined, g.id])] : d.joined.filter((x) => x !== g.id),
        };
      }),
    [],
  );
  const sendMessage = useCallback((id: string, text: string) => {
    const now = new Date();
    const msg: ChatMessage = {
      id: newId('msg'),
      author: '__me',
      text,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
    setData((d) => ({
      ...d,
      chats: { ...d.chats, [id]: [...(d.chats[id] ?? []), msg] },
      archiveDeleted: d.archiveDeleted.filter((x) => x !== id),
    }));
  }, []);
  const deleteArchive = useCallback(
    (id: string) => setData((d) => ({ ...d, archiveDeleted: [...new Set([...d.archiveDeleted, id])] })),
    [],
  );

  const addAssistant = useCallback(
    (msgs: AssistantMessage[]) => setData((d) => ({ ...d, assistantLog: [...d.assistantLog, ...msgs].slice(-60) })),
    [],
  );
  const clearAssistant = useCallback(() => setData((d) => ({ ...d, assistantLog: [] })), []);
  /** 신청 상태를 바꾸고, 바뀐 뒤 신청 중이면 true */
  const toggleFriendRequest = useCallback(
    (nickname: string) => {
      const on = !data.friendRequests.includes(nickname);
      setData((d) => ({
        ...d,
        friendRequests: on ? [...new Set([...d.friendRequests, nickname])] : d.friendRequests.filter((n) => n !== nickname),
      }));
      return on;
    },
    [data.friendRequests],
  );

  const value = useMemo<WorldApi>(
    () => ({
      ...data,
      gatherings,
      getGathering,
      isJoined,
      memberCount,
      messagesOf,
      updateProfile,
      setPrefs,
      dismissPlace,
      restorePlaces,
      setExpanded,
      join,
      leave,
      createGathering,
      putServerGatherings, // //추가 화면에서 useWorld() 로 꺼내 쓸 수 있게 내보냄
      putServerGathering,  // //추가
      sendMessage,
      deleteArchive,
      addAssistant,
      clearAssistant,
      toggleFriendRequest,
    }),
    // //수정 의존성 배열에 putServerGatherings, putServerGathering 추가 (이 값들이 바뀌면 다시 묶어 줌)
    [data, gatherings, getGathering, isJoined, memberCount, messagesOf, updateProfile, setPrefs, dismissPlace, restorePlaces, setExpanded, join, leave, createGathering, putServerGatherings, putServerGathering, sendMessage, deleteArchive, addAssistant, clearAssistant, toggleFriendRequest],
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld(): WorldApi {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorld must be used inside WorldProvider');
  return ctx;
}

/** 추천 상태를 여행·날짜별로 나누는 키 */
export function dayKey(tripId: string, day: string) {
  return `${tripId}:${day}`;
}
