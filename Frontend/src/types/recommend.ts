import type { CrowdFilter } from '@/constants/crowdLevels';

/**
 * 추천 도메인 서버 계약.
 *
 * `GET /api/v1/recommendations/places` 응답을 그대로 옮겼다. 화면이 쓰는 모양은 이 타입과
 * 거의 같아 따로 변환하지 않고, 카드가 필요한 값만 골라 읽는다.
 */

/** 추천에 쓰인 위치 출처. */
export type RecommendLocationSource = 'CURRENT_GPS' | 'CACHED_GPS' | 'NONE';

/**
 * 추천 결과를 만든 방식.
 *
 * `POPULAR_FALLBACK`은 위치가 없거나 AI 추천이 실패해 인기순으로 대신한 경우다. 그때도
 * 200으로 오므로 화면은 오류로 다루지 않는다.
 */
export type RecommendationType = 'PERSONALIZED' | 'POPULAR_FALLBACK';

/** 장소의 현재 영업 상태. */
export type BusinessStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/** 카드에 늘어놓는 핀 한 개. */
export interface PinPreview {
  /**
   * 핀 식별자.
   *
   * 명세는 number지만 백엔드 `Pin.id`는 UUID로 바뀌었다. 추천 카드는 장소 상세로만 이동해
   * 이 값을 쓰지 않으므로 명세를 그대로 둔다. 핀 상세로 바로 보내게 되면 그때 맞춘다.
   */
  pinId: number;
  /** 작성자의 뷰 신뢰도. 0~360 각도이며 링으로 그린다. */
  uploaderViewReliability: number;
}

/** 추천 목록 한 장. */
export interface RecommendedPlace {
  placeId: number;
  name: string;
  address: string;
  businessStatus: BusinessStatus;
  /** `영업중 · 오후 10:00까지`. 확인할 수 없으면 null이다. */
  businessHoursText: string | null;
  /** 지금 열람할 수 있는 전체 핀 수. */
  activePinCount: number;
  /** 활성 핀을 쓴 사람 수. 한 사람이 여러 개를 써도 하나로 센다. */
  uploaderCount: number;
  /** 가장 먼저 노출되는 핀의 작성자. 카드 문구에 그대로 쓴다(예: `감지카메라`). */
  representativeUploaderNickname: string;
  /** 최대 5개. 순서는 서버의 추천 정렬을 따른다. */
  pinPreviews: PinPreview[];
}

/** `GET /api/v1/recommendations/places` 응답의 `data`. */
export interface RecommendationsResponse {
  locationSource: RecommendLocationSource;
  recommendationType: RecommendationType;
  /** 추천을 만든 시각(ISO 8601). `N분 전 업데이트` 표기에 쓴다. */
  generatedAt: string;
  /**
   * 계열별 목록.
   *
   * 두 목록이 한 번에 오므로 토글을 바꿀 때 다시 요청하지 않는다. 결과가 없으면 빈 배열이다.
   */
  recommendations: Record<CrowdFilter, RecommendedPlace[]>;
}

/** 조회 조건. 좌표는 둘 다 보내거나 둘 다 생략한다. */
export interface RecommendationsQuery {
  latitude?: number;
  longitude?: number;
  /** 유형별 장소 수. 생략하면 서버 기본값을 쓴다. */
  limit?: number;
}
