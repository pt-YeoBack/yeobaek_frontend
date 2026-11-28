import { useEffect, useRef } from 'react';
import { saveSettings, ProfileSettingsRequest } from '../api/profile';
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav } from '../components/TripParts';
import { ChoiceChips, Switch } from '../components/WorldParts';
import { toVisibility, VISIBILITY_LABEL, VISIBILITY_OPTIONS, type Visibility } from '../components/ProfileInfo';
import { checkWhite, palette, shieldCheck, sliders } from '../components/icons';
import { ACCENT_PALETTES, isCustomAccent, paletteOf, swatchGradient } from '../lib/accent';
import { useAppState } from '../lib/appState';
import { Route, useNav } from '../lib/navigation';
import { logout } from '../api/auth';
import { KEYWORD_OPTIONS, Profile, TASTE_OPTIONS, useWorld } from '../lib/worldStore';

/** Mobile 22 (두 번째 프레임) · 세부 설정 — 여행 취향 · 공개 범위 · 대화 보관 */
export function Settings({ route }: { route: Extract<Route, { name: 'settings' }> }) {
  const { back, canGoBack, reset } = useNav();
  const { showToast } = useAppState();
  const { profile, updateProfile } = useWorld();
  const privacyRef = useRef<HTMLElement>(null);
  const colorRef = useRef<HTMLElement>(null);
  const current = paletteOf(profile.accent);
  const custom = profile.accent && isCustomAccent(profile.accent) ? paletteOf(profile.accent) : null;
  /**
   * 화면에 먼저 반영하고 서버에 저장한다 (PATCH /api/profile/settings).
   * 저장에 실패하면 이전 값으로 되돌리고 알려 준다.
   */
  const persist = async (patch: ProfileSettingsRequest, next: Partial<Profile>, previous: Partial<Profile>) => {
    updateProfile(next);
    const result = await saveSettings(patch);
    if (!result.ok) {
      updateProfile(previous);
      showToast(result.message ?? '설정을 저장하지 못했어요. 다시 시도해 주세요.', 'error');
      return false;
    }
    return true;
  };

  // 직접 고르는 색은 끌면서 값이 계속 바뀌므로 멈춘 뒤 0.4초 후에 한 번만 저장
  const colorTimer = useRef<number | undefined>(undefined);
  const savedAccent = useRef(profile.accent);
  useEffect(() => () => window.clearTimeout(colorTimer.current), []);

  const pick = (id: string, label: string, debounce = false) => {
    updateProfile({ accent: id });
    window.clearTimeout(colorTimer.current);
    const commit = async () => {
      const previous = savedAccent.current;
      if (await persist({ themeColor: id }, { accent: id }, { accent: previous })) {
        savedAccent.current = id;
        showToast(`프로필 액센트를 '${label}' 조합으로 바꿨어요.`);
      }
    };
    if (debounce) colorTimer.current = window.setTimeout(() => void commit(), 400);
    else void commit();
  };

  useEffect(() => {
    if (route.section === 'privacy') privacyRef.current?.scrollIntoView({ block: 'start' });
    if (route.section === 'color') colorRef.current?.scrollIntoView({ block: 'start' });
  }, [route.section]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setPrivacy = (patch: Partial<typeof profile.privacy>) => {
    const server: ProfileSettingsRequest = {};
    if (patch.name !== undefined) server.nameVisibility = patch.name;
    if (patch.contact !== undefined) server.phoneVisibility = patch.contact;
    if (patch.autosave !== undefined) server.noteAutoSave = patch.autosave;
    void persist(server, { privacy: { ...profile.privacy, ...patch } }, { privacy: profile.privacy });
  };
  const toggleTaste = (t: string) => {
    const tastes = toggle(profile.tastes, t);
    void persist({ preferences: tastes }, { tastes }, { tastes: profile.tastes });
  };
  const toggleKeyword = (t: string) => {
    const keywords = toggle(profile.keywords, t);
    void persist({ vibes: keywords }, { keywords }, { keywords: profile.keywords });
  };

  return (
    <ScreenShell
      frame="Mobile 22 Settings"
      tone="brand"
      title="세부 설정"
      onBack={canGoBack ? back : () => reset({ name: 'profile' })}
      trailing={<BellButton />}
      contentClassName="settings-content"
      bottomNav={<BottomNav active="profile" />}
    >
      <section aria-labelledby="taste-title">
        <h2 id="taste-title" className="guidance-title settings-heading">
          <img src={sliders} alt="" width={22} height={22} />
          여행 취향 수정
        </h2>
        <div className="settings-box">
          <ChoiceChips
            label="여행 취향 (여러 개 선택)"
            options={TASTE_OPTIONS}
            selected={profile.tastes}
            variant="soft"
            onToggle={toggleTaste}
          />
          <ChoiceChips
            label="여행 키워드 (여러 개 선택)"
            options={KEYWORD_OPTIONS}
            selected={profile.keywords}
            variant="soft"
            onToggle={toggleKeyword}
          />
        </div>
        <p className="form-help">고른 취향은 바로 저장되고 프로필에 보여요. 선택 {profile.tastes.length + profile.keywords.length}개</p>
      </section>

      <section aria-labelledby="privacy-title" ref={privacyRef}>
        <h2 id="privacy-title" className="guidance-title settings-heading">
          <img src={shieldCheck} alt="" width={22} height={22} />
          공개 범위·대화 보관 설정
        </h2>
        <div className="settings-box settings-switches">
          <ScopeChoice
            label="실명 공개 범위"
            description="다른 회원이 내 프로필에서 실명을 볼 수 있는 범위예요. 보이지 않으면 '비공개'로 표시돼요."
            value={toVisibility(profile.privacy.name)}
            onChange={(v) => setPrivacy({ name: v })}
          />
          <ScopeChoice
            label="연락처 공개 범위"
            description="다른 회원이 내 프로필에서 연락처를 볼 수 있는 범위예요. 보이지 않으면 '비공개'로 표시돼요."
            value={toVisibility(profile.privacy.contact)}
            onChange={(v) => setPrivacy({ contact: v })}
          />
          <Switch
            label="수첩 대화 기록 자동 저장"
            description="끄면 수첩에서 저장된 대화가 보이지 않아요."
            checked={profile.privacy.autosave}
            onChange={(v) => setPrivacy({ autosave: v })}
          />
        </div>
      </section>


      <section aria-labelledby="color-title" ref={colorRef}>
        <h2 id="color-title" className="guidance-title settings-heading color-heading">
          <img src={palette} alt="" width={22} height={22} />
          컬러 조합 선택
        </h2>
        <div className="color-widget">
          <div className="palette-row" role="radiogroup" aria-label="프로필 컬러 조합">
            {ACCENT_PALETTES.map((p) => {
              const on = current.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={p.label}
                  className={`palette-chip ${on ? 'is-on' : ''}`}
                  style={{ background: p.swatch[0] }}
                  onClick={() => pick(p.id, p.label)}
                >
                  <span className="palette-swatch" style={{ background: swatchGradient(p.swatch) }} />
                  {on && <img className="palette-check" src={checkWhite} alt="" width={18} height={18} />}
                </button>
              );
            })}
            {/* Figma의 '+' 칩: 직접 색을 고르는 동작은 해석해 추가 (브라우저 기본 색 선택기) */}
            <label
              className={`palette-chip palette-add ${custom ? 'is-on' : ''}`}
              style={custom ? { background: custom.swatch[0] } : undefined}
              title={custom ? custom.label : '직접 색 고르기'}
            >
              {custom ? (
                <>
                  <span className="palette-swatch" style={{ background: swatchGradient(custom.swatch) }} />
                  <img className="palette-check" src={checkWhite} alt="" width={18} height={18} />
                </>
              ) : (
                <span aria-hidden="true">+</span>
              )}
              <span className="sr-only">{custom ? `${custom.label} 선택됨 · 다른 색 고르기` : '직접 색 고르기'}</span>
              <input
                type="color"
                className="sr-only"
                value={custom ? custom.id : '#84afff'}
                onChange={(e) => pick(e.target.value.toLowerCase(), `직접 고른 색 ${e.target.value}`, true)}
              />
            </label>
          </div>
          <p className="color-help">원하는 컬러 조합을 선택해 프로필의 액센트를 변경하세요.</p>
        </div>
      </section>

      {/* Figma에 없는 부분: 기존 홈 프로필 시트에 있던 계정 기능을 여기로 옮김 */}
      <section className="account-box" aria-label="계정">
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            // 백엔드 토큰 쿠키 삭제 + localStorage(token, yeobaek.member) 정리
            await logout();
            reset({ name: 'login' });
          }}
        >
          로그아웃
        </button>
      </section>
    </ScreenShell>
  );
}

/** 공개 범위 고르기: 비공개 · 친구만 · 공개 중 하나 */
function ScopeChoice({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const labels = VISIBILITY_OPTIONS.map((v) => VISIBILITY_LABEL[v]);
  return (
    <div className="switch-row scope-row">
      <span className="switch-text">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <ChoiceChips
        label={label}
        options={labels}
        selected={[VISIBILITY_LABEL[value]]}
        multiple={false}
        variant="soft"
        onToggle={(l) => {
          const next = VISIBILITY_OPTIONS.find((v) => VISIBILITY_LABEL[v] === l);
          if (next && next !== value) onChange(next);
        }}
      />
    </div>
  );
}
