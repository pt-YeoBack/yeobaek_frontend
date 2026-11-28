// // [채팅] //추가 (새 파일) 모임 대화 서버 호출 — GatheringChat.tsx 가 씀 → 백엔드 ChatApiController 와 연결
// import ajax from '../utils/ajax'; // 토큰(출입증)을 붙여 /api 로 보내는 axios → 서버가 "누가 보냈는지" 앎
// import { errorReason } from './error'; // 실패 답에서 { reason, message } 꺼내기 → 화면 안내 문구
// import type { ChatMessage } from '../lib/worldStore'; // 화면 대화 한 줄 모양 → Bubble 이 그대로 그림
//
// export interface ServerChatMessage { // 서버가 보내는 메시지 한 개 (백엔드 ChatMessageDTO 와 칸 이름이 같아야 값이 들어옴)
//   id: number; // 메시지 번호 → 다음에 ?after= 로 "이 뒤의 것만" 받을 때 사용
//   chatId: number; // 채팅방 번호
//   senderId: number; // 보낸 사람 번호 → 내 번호와 같으면 내 말풍선
//   senderAlias: string; // 보낸 사람 닉네임 → 말풍선 위 이름
//   senderRole: 'host' | 'member' | null; // 모임장이면 "· 모임장" 표시, 나간 사람이면 null
//   message: string; // 내용
//   messageType: 'TEXT' | 'NOTICE'; // NOTICE = "OO님이 들어왔어요." 안내
//   createdDatetime: string; // 보낸 시각 "2026-12-01T19:05:00" → 말풍선 옆 "19:05"
// }
//
// type Fail = { ok: false; reason: string; message: string | null }; // 실패 모양 (api/together.ts 와 같음)
// const fail = (error: unknown): Fail => { // 오류 → Fail 모양으로
//   const e = errorReason(error); // network(서버 꺼짐) · not_member(참여 안 함) · ended(끝난 모임) …
//   return { ok: false, reason: e.reason, message: e.message };
// };
//
// /** 메시지 읽기: after 번호 뒤의 것만 (처음엔 0 → 내가 들어온 뒤의 대화 전부) */
// export async function fetchChatMessages(togetherId: number, after: number): Promise<{ ok: true; list: ServerChatMessage[] } | Fail> {
//   try {
//     const { data } = await ajax.get(`/together/${togetherId}/chat/messages`, { params: { after } }); // GET …?after=12 → ChatService.getMessages
//     return { ok: true, list: data as ServerChatMessage[] }; // 오래된 것 → 최신 순서
//   } catch (error) {
//     return fail(error); // 403 not_member: 참여 안 한 사람
//   }
// }
//
// /** 메시지 보내기 → 저장된 메시지 (닉네임 · 시각 포함) */
// export async function sendChatMessage(togetherId: number, message: string): Promise<{ ok: true; message: ServerChatMessage } | Fail> {
//   try {
//     const { data } = await ajax.post(`/together/${togetherId}/chat/messages`, { message }); // POST → ChatService.send → tbl_chat_message
//     return { ok: true, message: data as ServerChatMessage };
//   } catch (error) {
//     return fail(error); // 409 ended: 끝난 모임, 400: 빈 글 · 300자 초과
//   }
// }
//
// /** 서버 메시지 → 화면 대화 한 줄 (Bubble 이 쓰는 ChatMessage 모양) */
// export function toChatMessage(m: ServerChatMessage, myId: number | null): ChatMessage {
//   return {
//     id: String(m.id), // 화면 id 는 글자라서 숫자를 글자로
//     author: m.messageType === 'NOTICE' ? '__notice' : m.senderId === myId ? '__me' : m.senderAlias, // 안내 · 나 · 다른 사람 구분 → Bubble 모양이 달라짐
//     role: m.senderRole === 'host' ? '모임장' : undefined, // 모임장이면 이름 옆 "· 모임장"
//     text: m.message, // 내용
//     time: m.createdDatetime.slice(11, 16), // "2026-12-01T19:05:00" → "19:05"
//   };
// }
