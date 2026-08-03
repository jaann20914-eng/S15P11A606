import { ApiError } from '../client';
import { usesMock } from '../config';
import type { ApiModule } from '../config';
import { createDevLogger } from '@/utils/devLog';

const log = createDevLogger('chat-api');

/**
 * 채팅 API 한 번의 호출을 성공·실패까지 한 줄씩 남긴다.
 *
 * 채팅은 화면 하나가 목록 · 요청 · 응답 · 소켓을 함께 쓴다. 어디까지 됐는지 화면만 보고는 알 수
 * 없어서, 테스트할 때 터미널 한 화면으로 흐름이 이어져야 한다.
 *
 * 목업인지 실서버인지도 함께 남긴다. 목업으로 돌고 있는 것을 실서버 결과로 착각해 "됐다"고
 * 판단하는 일이 실제로 잦다.
 *
 * 오류는 다시 던진다. 로그는 관찰만 하고 흐름을 바꾸지 않는다.
 */
export async function traceChat<TResult>(
  name: string,
  module: ApiModule,
  run: () => Promise<TResult>,
  summarize: (result: TResult) => Record<string, unknown>,
): Promise<TResult> {
  const startedAt = Date.now();

  log(`${name} 요청`, { 출처: usesMock(module) ? '목업' : '실서버' });

  try {
    const result = await run();

    log(`${name} 성공`, { ...summarize(result), 소요: `${Date.now() - startedAt}ms` });
    return result;
  } catch (cause) {
    log(`${name} 실패`, {
      코드: cause instanceof ApiError ? cause.code : '없음',
      상태: cause instanceof ApiError ? cause.statusCode : undefined,
      내용: cause instanceof Error ? cause.message : String(cause),
      소요: `${Date.now() - startedAt}ms`,
    });
    throw cause;
  }
}
