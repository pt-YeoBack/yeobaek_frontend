import { useEffect } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { logo } from '../components/icons';
import { Route, useNav } from '../lib/navigation';
import { getSessionUser } from '../lib/session';

/**
 * Mobile 01 First Launch · 여백 로고 → 2초 후(또는 로고를 누르면) Mobile 01B 로 이동
 * 토큰(로그인 세션)이 남아 있으면 같은 2초 뒤 온보딩 대신 홈으로 간다.
 */
export function Splash({ route }: { route?: Extract<Route, { name: 'splash' }> }) {
  const { replace } = useNav();
  // getSessionUser() 는 토큰과 회원 정보가 둘 다 있을 때만 값이 있다
  const loggedIn = Boolean(getSessionUser());
  const next: Route = loggedIn ? { name: 'home', welcome: 'login' } : { name: 'onboarding' };

  const stay = Boolean(route?.stay);

  useEffect(() => {
    // 온보딩에서 '이전'으로 돌아온 경우엔 자동으로 넘기지 않고 로고를 눌러야 다음으로 이동
    // (로그인 상태라면 stay 와 상관없이 로고를 잠깐 보여 준 뒤 홈으로)
    if (stay && !loggedIn) return undefined;
    const id = window.setTimeout(() => replace(next), 2000);
    return () => window.clearTimeout(id);
  }, [replace, stay, loggedIn]);

  return (
    <ScreenShell frame="Mobile 01 First Launch" tone="brand" contentClassName="splash-content">
      <button
        type="button"
        className="splash-logo"
        onClick={() => replace(next)}
        aria-label="여백 Yeobaek — 시작하기"
      >
        <img src={logo} alt="" width={115} height={115} />
        <span className="splash-wordmark" aria-hidden="true">여백</span>
        <span className="splash-sub" aria-hidden="true">Y E O B A E K</span>
      </button>
      {stay && <p className="splash-hint">로고를 누르면 다시 시작해요</p>}
    </ScreenShell>
  );
}
