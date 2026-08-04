import { ApiError } from '../client';
import { usesMock } from '../config';
import type { ApiModule } from '../config';
import { createDevLogger } from '@/utils/devLog';

const log = createDevLogger('pin-api');

/**
 * 게시글 API 한 번의 호출을 성공·실패까지 한 줄씩 남긴다.
 *
 * 채팅·마이페이지에 둔 것과 같은 이유다(`api/chat/log.ts`). 상세 화면 하나가 조회·결제·평가·
 * 수정·삭제를 함께 쓰는데, 크레딧이 실제로 오가는 흐름이라 무엇이 서버까지 갔는지 화면만 보고
 * 판단하면 위험하다.
 *
 * 목업인지 실서버인지도 함께 남긴다. 목업으로 돌고 있는 것을 실서버 결과로 착각해 "됐다"고
 * 판단하는 일이 실제로 잦다.
 *
 * 오류는 다시 던진다. 로그는 관찰만 하고 흐름을 바꾸지 않는다.
 */
export async function tracePin<TResult>(
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
