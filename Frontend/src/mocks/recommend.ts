import type { CrowdFilter } from '@/constants/crowdLevels';
import type { Recommendation, RecommendedPlace } from '@/types/recommend';
import { MOCK_LATENCY_MS, delay } from './pin';

/**
 * 추천 장소 고정 데이터.
 *
 * 추천 API가 아직 없어 화면을 이 데이터로 돌린다. 명세가 나오면 이 파일만 쓰이지 않게 되고
 * 화면과 훅은 그대로 둔다.
 */

/** 화면에 있던 목업 목록을 그대로 옮긴 것. */
const places: RecommendedPlace[] = [
  { placeId: '1', name: '성수 연무장길', hours: '영업중 · 오후 10:00까지', address: '서울 성동구 연무장길', pinCount: 8, authorAngles: [320, 90, 270, 90, 180] },
  { placeId: '2', name: '서울숲 산책로', hours: '운영중 · 24시간 이용 가능', address: '서울 성동구 뚝섬로 273', pinCount: 12, authorAngles: [90, 180, 320, 270, 90] },
  { placeId: '3', name: '뚝섬한강공원', hours: '운영중 · 24시간 이용 가능', address: '서울 광진구 강변북로 139', pinCount: 6, authorAngles: [270, 90, 180, 320, 90] },
  { placeId: '4', name: '성수 카페거리', hours: '영업중 · 오후 11:00까지', address: '서울 성동구 성수이로', pinCount: 9, authorAngles: [180, 320, 90, 90, 270] },
  { placeId: '5', name: '연무장길 팝업존', hours: '영업중 · 오후 8:00까지', address: '서울 성동구 연무장길 24', pinCount: 14, authorAngles: [90, 270, 320, 180, 90] },
  { placeId: '6', name: '어린이대공원', hours: '운영중 · 오후 10:00까지', address: '서울 광진구 능동로 216', pinCount: 5, authorAngles: [320, 180, 90, 270, 90] },
  { placeId: '7', name: '건대 커먼그라운드', hours: '영업중 · 오후 10:00까지', address: '서울 광진구 아차산로 200', pinCount: 11, authorAngles: [90, 90, 180, 320, 270] },
  { placeId: '8', name: '송정제방길', hours: '운영중 · 24시간 이용 가능', address: '서울 성동구 송정동 73-448', pinCount: 4, authorAngles: [270, 320, 90, 180, 90] },
  { placeId: '9', name: '성수 수제화거리', hours: '영업중 · 오후 9:00까지', address: '서울 성동구 연무장7길', pinCount: 7, authorAngles: [180, 90, 270, 90, 320] },
  { placeId: '10', name: '서울숲 북쪽 산책로', hours: '운영중 · 24시간 이용 가능', address: '서울 성동구 서울숲2길', pinCount: 10, authorAngles: [90, 320, 90, 270, 180] },
];

/** 갱신 시각을 만들 때 거슬러 올라가는 분. 문자열로 박아 두면 시간이 지나도 그대로 남는다. */
const UPDATED_MINUTES_AGO = 16;

/**
 * 추천 목록 목업.
 *
 * 여유·와글 두 계열이 같은 장소를 다른 순서로 보여준다고 가정한다. 목록이 아예 바뀌지 않으면
 * 토글이 동작하는지 화면에서 확인할 수 없다.
 */
export async function fetchMockRecommendations(mode: CrowdFilter): Promise<Recommendation> {
  await delay(MOCK_LATENCY_MS);

  const updatedAt = new Date();
  updatedAt.setMinutes(updatedAt.getMinutes() - UPDATED_MINUTES_AGO);

  return {
    mode,
    updatedAt: updatedAt.toISOString(),
    // 와글은 핀이 많은 순으로 뒤집어 보여준다. 무작위를 쓰지 않아 볼 때마다 같은 순서다.
    places: mode === 'wagle' ? [...places].sort((a, b) => b.pinCount - a.pinCount) : places,
  };
}
