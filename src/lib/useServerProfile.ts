import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyProfile, toLocalProfile } from '../api/profile';
import { useWorld } from './worldStore';

/**
 * 서버에 저장된 프로필을 받아 worldStore profile 에 반영한다.
 * 프로필 · 컬러 · 대화 자동 저장 설정은 다른 화면도 worldStore 로 읽으므로 한 곳에 넣어 둔다.
 *  - enabled=false 면 요청하지 않는다 (로그인 전)
 *  - reload() 로 다시 받을 수 있다
 */
export function useServerProfile(enabled = true) {
  const { updateProfile } = useWorld();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    const result = await fetchMyProfile();
    if (ticket !== latest.current) return; // 더 새 요청이 있으면 무시
    setLoading(false);
    if (result.ok) updateProfile(toLocalProfile(result.profile));
    else setError(result.message ?? '프로필을 불러오지 못했어요.');
  }, [updateProfile]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { loading, error, reload };
}
