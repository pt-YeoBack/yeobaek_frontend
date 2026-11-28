import { ReactNode, useEffect } from 'react';
import { ToastHost } from './components/AuthParts';
import { AppStateProvider } from './lib/appState';
import { routeFromLocation } from './lib/entryRoute';
import { NavigationProvider, useNav } from './lib/navigation';
import { getSessionUser } from './lib/session';
import { useServerProfile } from './lib/useServerProfile';
import { TripProvider, useTrips } from './lib/tripStore';
import { WorldProvider, useWorld } from './lib/worldStore';
import { applyTheme } from './lib/themeRuntime';
import { ChatArchive } from './pages/ChatArchive';
import { GatheringChat } from './pages/GatheringChat';
import { MapPage } from './pages/Map';
import { ScheduleDay } from './pages/ScheduleDay';
import { GatheringCreate } from './pages/GatheringCreate';
import { GatheringDetail } from './pages/GatheringDetail';
import { Recommend } from './pages/Recommend';
import { Notebook } from './pages/Notebook';
import { ProfileEdit } from './pages/ProfileEdit';
import { MyProfile } from './pages/MyProfile';
import { RecommendResult } from './pages/RecommendResult';
import { ScheduleList } from './pages/ScheduleList';
import { MemberProfile } from './pages/MemberProfile';
import { FriendList } from './pages/FriendList';
import { Settings } from './pages/Settings';
import { RecommendList } from './pages/RecommendList';
import { CheckInbox } from './pages/CheckInbox';
import { Signup } from './pages/Signup';
import { FindPassword } from './pages/FindPassword';
import { Home } from './pages/Home';
import { ScheduleAdd } from './pages/ScheduleAdd';
import { Login } from './pages/Login';
import { OAuthCallback } from './pages/OAuthCallback';
import { ResetPassword } from './pages/ResetPassword';
import { TripCreate } from './pages/TripCreate';
import { Onboarding } from './pages/Onboarding';
import { Splash } from './pages/Splash';
import { VerifyCode } from './pages/VerifyCode';

function CurrentScreen() {
  const { route } = useNav();
  switch (route.name) {
    case 'splash':
      return <Splash route={route} />;
    case 'onboarding':
      return <Onboarding />;
    case 'signup':
      return <Signup />;
    case 'login':
      return <Login key={`${route.method}-${route.contact}`} route={route} />;
    case 'oauthCallback':
      return <OAuthCallback />;
    case 'forgot':
      return <FindPassword />;
    case 'checkInbox':
      return <CheckInbox route={route} />;
    case 'verify':
      return <VerifyCode key={`${route.purpose}-${route.contact}`} route={route} />;
    case 'newPassword':
      return <ResetPassword route={route} />;
    case 'home':
      return <Home />;
    case 'newTrip':
      return <TripCreate route={route} />;
    case 'itinerary':
      return <ScheduleAdd route={route} />;
    case 'schedules':
      return <ScheduleList />;
    case 'dayPlan':
      return <ScheduleDay key={route.tripId} route={route} />;
    case 'nearby':
      return <Recommend key={`${route.tripId}-${route.day}`} route={route} />;
    case 'suggestions':
      return <RecommendList key={`${route.tripId}-${route.day}`} route={route} />;
    case 'review':
      return <RecommendResult key={route.activityId} route={route} />;
    case 'connections':
      return <MapPage route={route} />;
    case 'gathering':
      return <GatheringDetail key={route.id} route={route} />;
    case 'gatheringNew':
      return <GatheringCreate />;
    case 'chat':
      return <GatheringChat key={route.id} route={route} />;
    case 'profile':
      return <MyProfile />;
    case 'notebook':
      return <Notebook key={route.tripId} route={route} />;
    case 'archive':
      return <ChatArchive key={route.gatheringId} route={route} />;
    case 'profileEdit':
      return <ProfileEdit />;
    case 'settings':
      return <Settings route={route} />;
    case 'friends':
      return <FriendList />;
    case 'member':
      return <MemberProfile key={route.memberId ?? route.nickname} route={route} />;
    default:
      return null;
  }
}

/** 로그인한 계정별로 여행 데이터를 분리한다. 화면 이동마다 다시 계산되므로 로그인/로그아웃 직후 바로 반영된다. */
function SessionScope({ children }: { children: ReactNode }) {
  useNav();
  const user = getSessionUser();
  const owner = user ? user.email ?? user.phone ?? null : null;
  return (
    <TripProvider key={owner ?? 'guest'} owner={owner}>
      <WorldScope owner={owner}>{children}</WorldScope>
    </TripProvider>
  );
}

/** Mobile 13~22 데이터(프로필·인연·대화). 예시 모임 날짜를 첫 여행에 맞추려고 여행 목록 안쪽에 둔다 */
function WorldScope({ owner, children }: { owner: string | null; children: ReactNode }) {
  const { trips } = useTrips();
  const first = [...trips].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
  return (
    <WorldProvider key={owner ?? 'guest'} owner={owner} baseDate={first?.startDate ?? null}>
      <AccentTheme enabled={Boolean(owner)} />
      <ServerProfileLoader enabled={Boolean(owner)} />
      {children}
    </WorldProvider>
  );
}

/** 로그인한 상태로 앱을 열면 서버에 저장된 프로필(닉네임 · 취향 · 공개 설정 · 컬러)을 한 번 받아 온다 */
function ServerProfileLoader({ enabled }: { enabled: boolean }) {
  useServerProfile(enabled);
  return null;
}

/** 로그인한 사용자의 컬러 조합(서버 thema_color)을 앱 전체(글자·버튼·배경·아이콘)에 적용. 로그아웃하면 기본 테마로 */
function AccentTheme({ enabled }: { enabled: boolean }) {
  const { profile } = useWorld();
  // 로그아웃 상태(로그인 · 가입 · 인증 화면)는 항상 기본 테마
  const accent = enabled ? profile.accent : null;
  useEffect(() => {
    applyTheme(accent);
  }, [accent]);
  useEffect(() => () => applyTheme(null), []);
  return null;
}

// 백엔드가 /member/join, /member/login 으로 보낸 경우 그 화면부터 시작
const entryRoute = routeFromLocation();

export default function App() {
  return (
    <AppStateProvider>
      <NavigationProvider
        initial={entryRoute ?? { name: 'splash' }}
        restore={!entryRoute && Boolean(getSessionUser())}
      >
        <SessionScope>
          <div className="app-stage">
            <CurrentScreen />
          </div>
        </SessionScope>
        <ToastHost />
      </NavigationProvider>
    </AppStateProvider>
  );
}
