import { formatPhone } from '../lib/validation';

/** 공개 범위 (백엔드 Visibility 와 같은 값) */
export type Visibility = 'private' | 'friends' | 'public';

export const VISIBILITY_OPTIONS: readonly Visibility[] = ['private', 'friends', 'public'];
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: '비공개',
  friends: '친구만',
  public: '공개',
};
export const toVisibility = (v: unknown): Visibility =>
  v === 'friends' || v === 'public' ? v : 'private';

/**
 * 프로필 상단(닉네임 아래)의 정보 줄 — 내 프로필(MyProfile)과 회원 프로필(MemberProfile)이 같이 쓴다
 *   실명 · 홍길동        (보는 사람에게 공개되지 않았으면 '비공개')
 *   연락처 · 010-1234-5678
 *   소개
 *  - 회원 프로필: 서버가 보는 사람 기준으로 정리해 준 visibility 를 그대로 쓴다 (안 보이면 private → '비공개')
 *  - 내 프로필(mine): 공개 범위와 상관없이 내 실명 · 연락처를 그대로 보여 준다 (범위는 세부 설정에서만)
 */
export function ProfileInfoLines({
  nameVisibility,
  name,
  phoneVisibility,
  phone,
  bio,
  emptyBio,
  mine = false,
}: {
  nameVisibility: Visibility;
  name?: string | null;
  phoneVisibility: Visibility;
  phone?: string | null;
  bio: string;
  /** 소개가 비었을 때 문구 */
  emptyBio: string;
  mine?: boolean;
}) {
  const line = (visibility: Visibility, value: string | null | undefined) => {
    if (!mine && visibility === 'private') return '비공개';
    return value || '등록되지 않음';
  };
  return (
    <p>
      실명 · {line(nameVisibility, name)}
      <br />
      연락처 · {line(phoneVisibility, phone ? formatPhone(phone) : phone)}
      <br />
      {bio || emptyBio}
    </p>
  );
}
