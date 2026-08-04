import { ApiError } from './client';
import { usesMock } from './config';
import type { ApiModule } from './config';
import { createDevLogger } from '@/utils/devLog';

/**
 * API 한 번의 호출을 성공·실패까지 한 줄씩 남기는 기록기를 만든다.
 *
 * 도메인마다 같은 코드를 두던 것을 한곳으로 모았다(채팅 · 마이페이지 · 게시글 · 추천).
 * 네 벌이 되면 한쪽만 고치는 일이 생긴다.
 *
 * 남기는 것이 세 가지다.
 * - **목업인지 실서버인지.** 목업으로 돌고 있는 것을 실서버 결과로 착각해 "됐다"고 판단하는
 *   일이 실제로 잦다
 * - 성공했을 때 화면 판단에 쓰이는 값 몇 개(호출하는 쪽이 고른다)
 * - 실패했을 때 오류 코드 · 상태 · 소요
 *
 * 오류는 다시 던진다. 기록은 관찰만 하고 흐름을 바꾸지 않는다.
 */
export function createTrace(scope: string) {
  const log = createDevLogger(scope);

  return async function trace<TResult>(
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
  };
}
