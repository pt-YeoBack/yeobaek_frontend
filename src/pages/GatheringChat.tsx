import { SafeForm } from '../components/SafeForm';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { BellButton, BottomNav, BottomSheet, ConfirmDialog } from '../components/TripParts';
import { bookOpen, check, plusBrand, send } from '../components/icons';
import { useAppState } from '../lib/appState';
import { fromISO, weekday } from '../lib/dates';
import { Route, useNav } from '../lib/navigation';
import { leaveTogether } from '../api/together'; // //추가 대화방 메뉴의 "모임 나가기" 를 서버에도 알림 → 인원 -1 (전에는 화면 메모리에서만 나갔음)
// [채팅 시작] 켤 때 아래 2줄의 // 를 지우세요
// import { fetchChatMessages, sendChatMessage, toChatMessage } from '../api/chat'; // 서버 대화 읽기 · 보내기 · 화면 모양으로 바꾸기 (api/chat.ts)
// import { getSessionUser } from '../lib/session'; // 내 회원 번호 → 내가 보낸 말(오른쪽 말풍선)인지 구분
// [채팅 끝]
import { ChatMessage, Gathering, useWorld } from '../lib/worldStore';

export function longDate(iso: string): string {
  const d = fromISO(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday(iso)}요일`;
}

export function memberLine(g: Gathering, me: string, includeMe: boolean): string {
  const names = [...g.members.map((m) => m.nickname)];
  if (includeMe) names.splice(g.mine ? 0 : Math.min(2, names.length), 0, me);
  return `${names.join(' · ')} / ${names.length}명`;
}

/** Mobile 19 Group Chat · 수첩에 저장되는 대화 */
export function GatheringChat({ route }: { route: Extract<Route, { name: 'chat' }> }) {
  const { back, canGoBack, reset, replace, push } = useNav();
  const { showToast } = useAppState();
  const world = useWorld();
  const g = world.getGathering(route.id);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const joined = g ? world.isJoined(g.id) || g.mine : false;
  const messages = g ? world.messagesOf(g.id) : [];
  // [채팅 시작] 켤 때 바로 위 줄(const messages = …)을 지우고, 아래 줄들의 // 를 지우세요
  // const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]); // 서버에서 받은 대화 (내가 들어온 시각 이후의 것만 옴)
  // const [tick, setTick] = useState(0); // 메시지를 보낸 직후 바로 다시 읽으려고 바꾸는 숫자 → 아래 useEffect 를 다시 돌림
  // const lastId = useRef(0); // 마지막으로 받은 메시지 번호 → 다음에는 이 번호 뒤의 것만 받음 (?after=)
  // const myId = getSessionUser()?.id ?? null; // 내 회원 번호 → toChatMessage 에서 '__me' 구분
  // const serverId = g?.serverId; // 서버 모임 번호 (예시 모임이면 undefined → 서버 호출 안 함)
  // useEffect(() => { // 대화방에 있는 동안 3초마다 새 메시지 확인 (폴링 = 주기적으로 물어보기)
  //   if (!serverId || !joined) return; // 서버 모임이고 참여 중일 때만
  //   let stop = false; // 화면을 나가면 true → 늦게 도착한 답은 버림
  //   const load = async () => { // 새 메시지 받기
  //     const r = await fetchChatMessages(serverId, lastId.current); // GET /api/together/{번호}/chat/messages?after=마지막번호 → ChatApiController
  //     if (stop || !r.ok || r.list.length === 0) return; // 나갔거나 · 실패했거나 · 새 것이 없으면 끝
  //     lastId.current = Math.max(lastId.current, r.list[r.list.length - 1].id); // 마지막 번호 갱신 → 다음 요청은 그 뒤만
  //     setServerMessages((prev) => { // 이미 받은 번호는 빼고 뒤에 붙임 (두 번 받아도 한 번만 보임)
  //       const seen = new Set(prev.map((m) => m.id));
  //       return [...prev, ...r.list.map((m) => toChatMessage(m, myId)).filter((m) => !seen.has(m.id))];
  //     });
  //   };
  //   void load(); // 들어오자마자 한 번
  //   const timer = window.setInterval(load, 3000); // 그 뒤 3초마다
  //   return () => { // 화면을 나가면 멈춤 (안 멈추면 다른 화면에서도 계속 서버를 부름)
  //     stop = true;
  //     window.clearInterval(timer);
  //   };
  // }, [serverId, joined, myId, tick]); // tick 이 바뀌면(보낸 직후) 바로 다시 읽음
  // const messages = serverId ? serverMessages : g ? world.messagesOf(g.id) : []; // 서버 모임 = 서버 대화, 예시 모임 = 기존 메모리 대화
  // [채팅 끝]

  useEffect(() => {
    if (!g) reset({ name: 'connections' });
    else if (!joined) replace({ name: 'gathering', id: g.id });
  }, [g, joined, reset, replace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!g || !joined) return null;
  const me = world.profile.privacy.nickname ? world.profile.nickname : '여행자';
  const autosave = world.profile.privacy.autosave;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    // [채팅 시작] 켤 때 아래 줄들의 // 를 지우세요
    // if (g.serverId) { // 서버 모임이면 서버에 저장
    //   void sendChatMessage(g.serverId, v).then((r) => { // POST /api/together/{번호}/chat/messages → tbl_chat_message 에 한 줄
    //     if (r.ok) setTick((t) => t + 1); // 저장되면 바로 다시 읽기 → 내 말이 목록에 나타남 (다른 사람은 3초 안에 봄)
    //     else showToast(r.message ?? '메시지를 보내지 못했어요.', 'error'); // 끝난 모임 · 300자 초과 등은 서버 문구 그대로
    //   });
    //   setText(''); // 입력칸 비우기
    //   return; // 아래 메모리 저장(예시 모임용)은 하지 않음
    // }
    // [채팅 끝]
    world.sendMessage(g.id, v);
    setText('');
  };

  return (
    <ScreenShell
      frame="Mobile 19 Group Chat"
      tone="brand"
      title={g.title}
      subtitle={memberLine(g, me, true)}
      onBack={canGoBack ? back : () => replace({ name: 'gathering', id: g.id })}
      trailing={<BellButton />}
      contentClassName="chat-content"
      bottomNav={<BottomNav active="connections" />}
    >
      <section className="chat-info">
        <strong>
          {g.date.slice(5).replace('-', '.')} {g.start}–{g.end} · {g.place}
        </strong>
        <span>
          {g.meetNote} · {world.memberCount(g)} / {g.maxPeople}명 참여
        </span>
      </section>

      <button
        type="button"
        role="switch"
        aria-checked={autosave}
        className="save-toggle"
        onClick={() => {
          world.updateProfile({ privacy: { ...world.profile.privacy, autosave: !autosave } });
          showToast(autosave ? '수첩 자동 저장을 껐어요. 수첩에서 이 대화가 보이지 않아요.' : '대화를 수첩에 저장해요.');
        }}
      >
        <img src={bookOpen} alt="" width={20} height={20} />
        <span>{autosave ? '대화는 수첩에 저장돼요' : '수첩 저장이 꺼져 있어요'}</span>
        {autosave && <img src={check} alt="" width={17} height={17} />}
      </button>

      <p className="chat-date">{longDate(g.date)} · 현지 시간</p>

      <ol className="chat-list" aria-label="대화 내용" aria-live="polite">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} me={me} onAuthor={(nickname) => push({ name: 'member', nickname, gatheringId: g.id })} />
        ))}
      </ol>
      <div ref={endRef} />

      <SafeForm className="chat-input" onSubmit={submit}>
        <button type="button" className="icon-button" aria-label="사진·파일 첨부" onClick={() => showToast('첨부 기능은 서버 연결 후 제공돼요.')}>
          <img src={plusBrand} alt="" width={20} height={20} />
        </button>
        <label className="sr-only" htmlFor="chat-text">
          메시지
        </label>
        <input id="chat-text" value={text} maxLength={300} placeholder="메시지를 입력해 주세요" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="chat-send" aria-label="보내기" disabled={!text.trim()}>
          <img src={send} alt="" width={36} height={36} />
        </button>
      </SafeForm>

      <div className="chat-foot">
        <span>{autosave ? '수첩 저장 중 · 여행 후에도 다시 읽어요' : '수첩에 저장하지 않는 중'}</span>
        <button type="button" className="link-button" onClick={() => setMenu(true)}>
          신고 / 나가기
        </button>
      </div>
      <p className="footnote">데모: 서버가 없어서 내가 보낸 메시지는 이 브라우저에만 저장되고 다른 참여자에게 전달되지 않아요.</p>

      {menu && (
        <BottomSheet title="대화방 메뉴" onClose={() => setMenu(false)}>
          <div className="sheet-actions sheet-actions-stack">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMenu(false);
                showToast('신고 기능은 서버 연결 후 제공돼요. 지금은 접수되지 않아요.');
              }}
            >
              신고하기 (연결 필요)
            </button>
            {!g.mine && (
              <button
                type="button"
                className="btn-text btn-text-danger"
                onClick={() => {
                  setMenu(false);
                  setLeaving(true);
                }}
              >
                모임 나가기
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      {leaving && (
        <ConfirmDialog
          title="모임에서 나갈까요?"
          message="대화방에서 나가요. 나중에 다시 참여할 수 있어요."
          confirmLabel="나가기"
          danger
          onCancel={() => setLeaving(false)}
          onConfirm={async () => { // //수정 async: 서버 답을 기다렸다가 나감
            setLeaving(false);
            if (g.serverId) { // //추가 서버 모임이면 서버에서도 나가기 → DELETE /api/together/{번호}/join (인원 -1)
              const r = await leaveTogether(g.serverId);
              if (!r.ok) { // //추가 실패(모임장 · 서버 꺼짐 등)면 나가지 않고 이유만 보여 줌
                showToast(r.message ?? '모임에서 나가지 못했어요.', 'error');
                return;
              }
            }
            world.leave(g.id); // 화면 저장소에서도 참여 기록 지우기 → 상세 화면 버튼이 "모임 대화 들어가기" 로 돌아감
            showToast('모임에서 나왔어요.');
            reset({ name: 'connections' });
          }}
        />
      )}
    </ScreenShell>
  );
}

export function Bubble({ m, me, onAuthor }: { m: ChatMessage; me: string; onAuthor?: (nickname: string) => void }) {
  const mine = m.author === '__me';
  // [채팅 시작] 켤 때 아래 줄의 // 를 지우세요
  // if (m.author === '__notice') return <li className="chat-date">{m.text}</li>; // "OO님이 들어왔어요." 안내는 말풍선 대신 가운데 작은 글씨
  // [채팅 끝]
  return (
    <li className={`bubble-row ${mine ? 'is-mine' : ''}`}>
      {!mine && onAuthor ? (
        <button type="button" className="bubble-author bubble-author-link" onClick={() => onAuthor(m.author)} aria-label={`${m.author} 프로필 보기`}>
          {m.author}
          {m.role ? ` · ${m.role}` : ''}
        </button>
      ) : (
        <span className="bubble-author">
          {mine ? me : m.author}
          {m.role ? ` · ${m.role}` : ''}
        </span>
      )}
      <p className="bubble">{m.text}</p>
      <span className="bubble-time">{m.time}</span>
    </li>
  );
}
