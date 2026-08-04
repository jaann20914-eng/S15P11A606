import { createTrace } from '../trace';

/**
 * 추천 API 호출 기록.
 *
 * 결과가 비어 있을 때 위치를 못 잡은 것인지, 주변에 핀이 없는 것인지, 요청이 실패한 것인지
 * 화면만 보고는 구분할 수 없다. 위치 출처와 계열별 개수를 함께 남긴다.
 */
export const traceRecommend = createTrace('recommend-api');
