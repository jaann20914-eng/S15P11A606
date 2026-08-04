// 백엔드 영상핀 응답에 맞춘 도메인 타입.
import type { CrowdLevelKey } from '@/constants/crowdLevels';

/**
 * 핀 식별자.
 *
 * 백엔드가 UUID를 쓴다(`Pin.id`는 `@GeneratedValue(strategy = UUID)`). 숫자로 다루면
 * `Number('0f8c…')`가 `NaN`이 되어 경로 파라미터를 읽는 순간 조용히 깨진다.
 *
 * 값을 계산하거나 비교해서 순서를 매기지 않는다. 서버가 준 문자열을 그대로 들고 다니다가
 * 그대로 돌려보내기만 한다. 별칭으로 두는 이유는 나중에 형식이 또 바뀌어도 한 곳만 고치면
 * 되게 하려는 것이다.
 */
export type PinId = string;

/**
 * 핀 처리 상태.
 *
 * 2026-07-28 기준 DB(`PENDING/PROCESSING/COMPLETED/FAILED`)와
 * API 명세(`PROCESSING/ACTIVE/RESHOOT`)의 값이 서로 달라 확정되지 않았다.
 * 상세 조회 응답에는 포함되지 않는다(삭제·만료 핀은 404).
 */
export type PinStatus = 'UPLOADING' | 'PROCESSING' | 'ACTIVE' | 'EXPIRED' | 'HIDDEN' | 'FAILED';

export type VideoPin = {
  /** 서버 식별자. DB가 BIGINT라 숫자로 다룬다. */
  id: number;
  placeId: number;
  crowdLevel: CrowdLevelKey;
  capturedAt: string;
  expiresAt: string;
  status: PinStatus;
};

/**
 * 핀 유용성 평가.
 *
 * 상세 조회는 완료 여부(`isEvaluated`)만 주고 어느 쪽을 골랐는지는 알려주지 않는다.
 * 작성자 뷰 각도에 `HELPFUL` +1, `NOT_HELPFUL` -0.5로 반영된다.
 */
export type PinRating = 'HELPFUL' | 'NOT_HELPFUL';

/**
 * 핀 삭제 응답 `data`.
 *
 * 물리 삭제가 아니라 `DELETED` 상태 전환이다.
 * 같은 작성자가 이미 삭제된 핀을 다시 요청하면 같은 결과를 돌려준다(멱등).
 */
export type PinDeleteResult = {
  pinId: PinId;
  status: 'DELETED';
  /** 삭제와 함께 CLOSED로 바뀐 채팅방. 없으면 빈 배열이다. */
  closedChatRoomIds: number[];
  deletedAt: string;
};

/** 평가 등록 응답 `data`. */
export type PinEvaluationResult = {
  evaluationId: number;
  pinId: PinId;
  rating: PinRating;
  /** 평가자에게 지급된 크레딧. 정상 최초 평가는 1이다. */
  rewardCredit: number;
};

/**
 * 현재 사용자의 영상 접근 수준.
 * - `OWNER` 작성자 본인
 * - `UNLOCKED` 크레딧을 써서 열람함
 * - `PREVIEW_BLURRED` 미구매. 블러 미리보기만 받는다
 */
export type PinVideoAccess = 'OWNER' | 'UNLOCKED' | 'PREVIEW_BLURRED';

/** 현재 사용자와 이 핀 사이의 채팅 요청·방 상태. */
export type PinChatRequestState = 'NONE' | 'PENDING' | 'ACTIVE' | 'CLOSED';

/**
 * 서버가 쓰는 혼잡 단계 값(DB `pin.crowd_level`).
 * 프론트 공용 토큰 `CrowdLevelKey`와 이름이 달라 API 경계에서 변환한다.
 */
export type PinCrowdLevel = 'WAGLE_WAGLE' | 'WAGLE' | 'RELAXED' | 'LEISURELY';

/**
 * 핀이 등록된 장소 요약.
 *
 * **주소는 오지 않는다.** 서버가 주소를 저장하지 않아 이름과 좌표만 준다. 주소가 필요하면
 * 카카오에서 따로 받아야 한다.
 *
 * 식별자가 둘이다. `placeId`는 우리 DB의 것이고 `kakaoPlaceId`는 카카오의 것이다. 수정 API가
 * 받는 것은 앞의 것이다.
 */
export type PinPlaceSummary = {
  placeId: number;
  kakaoPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
};

/**
 * `GET /api/v1/pins/{pinId}` 응답 `data` 원형.
 *
 * 서버가 보낸 그대로다. 화면은 이 타입을 쓰지 않고, API 경계에서 `PinDetail`로 바꾼 값을 쓴다.
 *
 * 영상이 **하나**다. `videoUrl`은 AI가 얼굴을 가린 최종 영상이고, 접근 수준과 상관없이 같은
 * 값이 온다(`PinDetailService`가 언제나 `blurredVideoKey`로 발급한다). 결제로 받는
 * `PinUnlockResult.videoUrl`도 같은 키다 — 결제는 접근 권한과 크레딧을 처리할 뿐 다른 영상을
 * 주지 않는다. 그래서 열람 전 가림은 화면에서 처리한다(`PinDetailMedia`).
 */
export type PinDetailResponse = {
  pinId: PinId;
  authorViewAngle: number;
  authorNickname: string;
  createdAt: string;
  /** 공개가 끝나는 시각(ISO 8601). 만료 뒤에는 작성자만 열람할 수 있다(2026-08-05 추가). */
  expiresAt: string;
  place: PinPlaceSummary;
  crowdLevel: PinCrowdLevel;
  detailLocation: string | null;
  memo: string | null;
  tags: string[];
  videoAccess: PinVideoAccess;
  isEvaluated: boolean | null;
  /** 얼굴을 가린 최종 영상의 signed URL. 접근 수준과 무관하게 같은 값이 온다. */
  videoUrl: string | null;
  /** 썸네일 이미지의 signed URL. 목록·공유 카드에 쓸 수 있다. */
  thumbnailUrl: string | null;
  canRequestChat: boolean;
  chatRequestState: PinChatRequestState;
};

/**
 * 화면이 쓰는 게시글 상세.
 *
 * 서버 응답과 한 가지만 다르다. `crowdLevel`이 프론트 공용 토큰(`CrowdLevelKey`)으로 바뀐다.
 * 화면 편의를 위한 파생값은 넣지 않고 아래 헬퍼(`isOwnPin` 등)로 판정한다.
 */
export type PinDetail = {
  pinId: PinId;
  place: PinPlaceSummary;
  /**
   * 작성자의 공개 뷰 각도. 프로필 링 안에 `90°`처럼 표시한다.
   * DB `member.view_angle` 기준으로 90~360 범위다.
   */
  authorViewAngle: number;
  /** 익명 정책이 적용된 작성자 표시명. 내 핀이어도 서버가 그대로 내려준다. */
  authorNickname: string;
  /** 핀 등록 시각(ISO 8601). "40초 전 업로드" 표기에 쓴다. */
  createdAt: string;
  crowdLevel: CrowdLevelKey;
  /** 층·좌석 등 장소 내부 위치. 없으면 null. */
  detailLocation: string | null;
  memo: string | null;
  tags: string[];
  videoAccess: PinVideoAccess;
  /** `UNLOCKED`일 때만 boolean, 그 외에는 null. */
  isEvaluated: boolean | null;
  /** 재생할 영상. 서버 응답의 `videoUrl`을 그대로 쓴다. */
  videoUrl: string | null;
  /**
   * 열람 전에 보여줄 영상.
   *
   * 서버가 접근 수준에 따라 다른 영상을 주지는 않는다(`PinDetailResponse` 설명 참고).
   * 같은 URL을 담아 두고 가리는 일은 화면이 한다. 서버가 나중에 미리보기용 영상을 따로 주면
   * 이 값만 그것으로 바꾸면 된다.
   */
  previewUrl: string | null;
  /** 썸네일 이미지. 아직 화면에서 쓰지 않지만 응답에 있어 함께 들고 다닌다. */
  thumbnailUrl: string | null;
  canRequestChat: boolean;
  chatRequestState: PinChatRequestState;
};

/** 서버 혼잡 단계 → 프론트 공용 토큰. 지도·추천이 쓰는 `crowdLevels`와 같은 키를 쓴다. */
const CROWD_LEVEL_BY_SERVER_VALUE: Record<PinCrowdLevel, CrowdLevelKey> = {
  LEISURELY: 'QUIET',
  RELAXED: 'NOT_CROWDED',
  WAGLE: 'CROWDED',
  WAGLE_WAGLE: 'VERY_CROWDED',
};

/** 모르는 값이 와도 화면이 죽지 않도록 가장 낮은 단계로 떨어뜨린다. */
export function toCrowdLevelKey(value: PinCrowdLevel): CrowdLevelKey {
  return CROWD_LEVEL_BY_SERVER_VALUE[value] ?? 'QUIET';
}

const SERVER_VALUE_BY_CROWD_LEVEL: Record<CrowdLevelKey, PinCrowdLevel> = {
  QUIET: 'LEISURELY',
  NOT_CROWDED: 'RELAXED',
  CROWDED: 'WAGLE',
  VERY_CROWDED: 'WAGLE_WAGLE',
};

/**
 * 프론트 토큰을 서버 enum으로 바꾼다. 핀을 등록·수정할 때 쓴다.
 *
 * 프론트는 `CrowdLevelKey`(`QUIET` 등)로 다루고 서버는 `WAGLE_WAGLE` 계열을 쓴다.
 * 두 표기를 오가는 지점을 이 파일 한 곳으로 모아 둔다.
 */
export function toServerCrowdLevel(key: CrowdLevelKey): PinCrowdLevel {
  return SERVER_VALUE_BY_CROWD_LEVEL[key];
}

/** 영상 잠금 해제(결제) 응답 `data`. */
export type PinUnlockResult = {
  pinId: PinId;
  /** 이번 요청에서 실제로 차감된 크레딧. 재구매·작성자는 0이다. */
  creditCharged: number;
  /** 처리 후 잔액. */
  creditBalance: number;
  videoUrl: string;
  accessGranted: boolean;
};

/** 내가 쓴 핀인지. 수정·삭제·떠났어요 노출 기준이다. */
export function isOwnPin(detail: PinDetail): boolean {
  return detail.videoAccess === 'OWNER';
}

/** 블러 없이 원본을 볼 수 있는지. */
export function isVideoUnlocked(detail: PinDetail): boolean {
  return detail.videoAccess === 'OWNER' || detail.videoAccess === 'UNLOCKED';
}

/** 평가 영역을 보여줄 상황인지. 작성자 본인과 미구매자는 평가 대상이 아니다. */
export function canEvaluate(detail: PinDetail): boolean {
  return detail.videoAccess === 'UNLOCKED';
}

/**
 * 오늘 등록한 영상핀의 처리 상태.
 *
 * `GET /api/v1/users/me/pins/today`가 주는 값이다. 내부 상태(`VideoStatus`)를 그대로 주지 않고
 * 화면용으로 바꿔 내려준다(백엔드 `TodayPinStatus.from`).
 *
 * - `PROCESSING`: AI 검수 중. 아직 공개되지 않아 상세를 열 수 없다(내부 `PENDING`)
 * - `ACTIVE`: 공개됨
 * - `RESHOOT`: 검수에서 걸러져 다시 찍어야 한다(내부 `REJECTED`)
 * - `FAILED`: 처리 중 오류로 등록되지 못했다
 *
 * 네 가지 모두 실제로 온다. 표에서 빠뜨리면 컴파일에서 걸리도록 `Record<TodayPinStatus, …>`로
 * 두었다(`MyPinList`의 `statusLabel`).
 */
export type TodayPinStatus = 'PROCESSING' | 'ACTIVE' | 'RESHOOT' | 'FAILED';

/** 오늘 등록한 영상핀 한 건. */
export interface TodayPin {
  pinId: PinId;
  placeId: number;
  placeName: string;
  placeAddress: string;
  status: TodayPinStatus;
  /** ISO 8601. */
  createdAt: string;
}

/** `GET /api/v1/users/me/pins/today` 응답의 `data`. */
export interface TodayPinsResponse {
  items: TodayPin[];
  /** 다음 페이지가 없으면 `null`. */
  nextCursor: string | null;
}

/** 조회 조건. 오늘 범위는 서버가 정한다(Asia/Seoul 오전 4시 경계). */
export interface TodayPinsQuery {
  /** 이전 응답의 `nextCursor`만 넣는다. */
  cursor?: string;
  /** 기본값 20, 최댓값 50. */
  limit?: number;
}
