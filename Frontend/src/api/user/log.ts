import { createTrace } from '../trace';

/**
 * 마이페이지 API 호출 기록.
 *
 * 한 화면이 프로필 · 활동 · 오늘 핀 · 크레딧을 함께 쓰므로, 어디까지 됐는지 화면만 보고는
 * 알 수 없다.
 */
export const traceUser = createTrace('user-api');
