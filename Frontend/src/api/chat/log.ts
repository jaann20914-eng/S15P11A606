import { createTrace } from '../trace';

/**
 * 채팅 API 호출 기록.
 *
 * 화면 하나가 목록 · 요청 · 응답 · 소켓을 함께 쓴다. 어디까지 됐는지 화면만 보고는 알 수
 * 없어서, 테스트할 때 터미널 한 화면으로 흐름이 이어져야 한다.
 */
export const traceChat = createTrace('chat-api');
