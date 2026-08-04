import { createTrace } from '../trace';

/**
 * 게시글 API 호출 기록.
 *
 * 상세 화면 하나가 조회 · 결제 · 평가 · 수정 · 삭제를 함께 쓰는데, 크레딧이 실제로 오가는
 * 흐름이라 무엇이 서버까지 갔는지 화면만 보고 판단하면 위험하다.
 */
export const tracePin = createTrace('pin-api');
