import type { CrowdFilter } from '@/constants/crowdLevels';
import type { PinId } from './pin';

/**
 * 추천 도메인 서버 계약.
 *
 * `GET /api/v1/recommendations/places` 응답을 그대로 옮겼다. 화면이 쓰는 모양은 이 타입과
 * 거의 같아 따로 변환하지 않고, 카드가 필요한 값만 골라 읽는다.
 */

/** 추천에 쓰인 위치 출처. */
export type RecommendLocationSource = 'CURRENT_GPS' | 'CACHED_GPS';

/**
 * 추천 결과를 만든 방식.
 *
 * `POPULAR_FALLBACK`은 위치가 없거나 AI 추천이 실패해 인기순으로 대신한 경우다.
 *
 * **서버 응답에는 아직 이 필드가 없다**(`RecommendationResponse`는 위치 출처 · 생성 시각 ·
 * 목록만 준다). 명세에 있어 화면이 안내 문구를 준비해 두었으므로 선택 필드로 남긴다 —
 * 서버가 주기 시작하면 화면이 그대로 받는다.
 */
export type RecommendationType = 'PERSONALIZED' | 'POPULAR_FALLBACK';

/** 장소의 현재 영업 상태. */
export type BusinessStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/** 카드에 늘어놓는 핀 한 개. */
export interface PinPreview {
  /** 핀 식별자(UUID). 카드는 장소 상세로만 이동해 이 값을 링의 키로만 쓴다. */
  pinId: PinId;
  /** 작성자의 뷰 신뢰도. 0~360 각도이며 링으로 그린다. */
  uploaderViewAngle: number;
}

/** 추천 목록 한 장. */
export interface RecommendedPlace {
  placeId: number;
  name: string;
  address: string;
  /**
   * 장소 좌표.
   *
   * 명세에 아직 없어 선택 필드다. 있으면 상세 화면이 두 가지를 얻는다.
   * - 지도를 그 좌표로 곧바로 만든다
   * - 영상핀 좌표를 받아 올 때(`GET /api/v1/places`) 그 자리 주변 좁은 범위로 물어본다.
   *   없으면 기본 중심 주변을 넓게 훑어야 하고, 그 안에 없는 장소는 못 찾는다
   */
  latitude?: number;
  longitude?: number;
  /** 장소 전화번호. 없는 장소도 있어 null이 온다. */
  phone?: string | null;
  /**
   * 영업 상태와 안내 문구.
   *
   * **서버가 아직 주지 않는다**(`PlaceCard`에 없다). 카드가 영업시간 줄을 그리려고 준비해 둔
   * 자리라 선택으로 남긴다 — 값이 없으면 그 줄을 그리지 않는다.
   */
  businessStatus?: BusinessStatus;
  businessHoursText?: string | null;
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
  /** 아직 서버가 주지 않는다. `RecommendationType` 설명 참고. */
  recommendationType?: RecommendationType;
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
