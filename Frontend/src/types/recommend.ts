import type { CrowdFilter } from '@/constants/crowdLevels';

/**
 * 추천 장소 화면이 쓰는 모양.
 *
 * 서버 응답 규격이 아직 없다. 화면이 실제로 그리는 값만 정의했고, 명세가 나오면 이 파일을
 * 서버 계약에 맞추고 훅에서 변환한다.
 */

/** 추천 목록 한 장. */
export interface RecommendedPlace {
  placeId: string;
  name: string;
  /** `영업중 · 오후 10:00까지`처럼 그대로 표시하는 문구. */
  hours: string;
  address: string;
  /** 이 장소에 올라온 영상핀 수. */
  pinCount: number;
  /**
   * 카드에 늘어놓는 작성자 뷰 각도.
   *
   * 장소마다 다르다. 실제로는 그 장소 핀들의 작성자 각도가 오고, 카드는 앞에서 몇 개만 보여준다.
   */
  authorAngles: number[];
}

/** 추천 목록 한 묶음. */
export interface Recommendation {
  /** 여유·와글 중 어느 쪽을 고른 결과인지. */
  mode: CrowdFilter;
  /** 추천을 다시 계산한 시각(ISO 8601). `16분 전 업데이트` 표기에 쓴다. */
  updatedAt: string;
  places: RecommendedPlace[];
}
