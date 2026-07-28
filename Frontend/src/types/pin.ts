import type { CrowdLevelKey } from '@/constants/crowdLevels';

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

/** 평가 등록 응답 `data`. */
export type PinEvaluationResult = {
  evaluationId: number;
  pinId: number;
  rating: PinRating;
  /** 평가자에게 지급된 크레딧. 정상 최초 평가는 1이다. */
  rewardCredit: number;
  createdAt: string;
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
 * 명세에 `place: {}`로만 적혀 있어 필드가 확정되지 않았다.
 * 상세 화면이 실제로 쓰는 값만 우선 정의했고 서버 응답이 나오면 맞춘다.
 */
export type PinPlaceSummary = {
  placeId: number;
  name: string;
  address: string;
};


/**
 * `GET /api/v1/pins/{pinId}` 응답 `data` 원형.
 *
 * 서버가 보낸 그대로다. 화면은 이 타입을 쓰지 않고, API 경계에서 `PinDetail`로 바꾼 값을 쓴다.
 */
export type PinDetailResponse = Omit<PinDetail, 'crowdLevel'> & {
  crowdLevel: PinCrowdLevel;
};

/**
 * 화면이 쓰는 게시글 상세.
 *
 * 서버 응답과 한 가지만 다르다. `crowdLevel`이 프론트 공용 토큰(`CrowdLevelKey`)으로 바뀐다.
 * 화면 편의를 위한 파생값은 넣지 않고 아래 헬퍼(`isOwnPin` 등)로 판정한다.
 */
export type PinDetail = {
  pinId: number;
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
  /** `OWNER`·`UNLOCKED`일 때만 발급되는 signed URL. */
  videoUrl: string | null;
  /** `PREVIEW_BLURRED`일 때 제공되는 블러 미리보기 signed URL. */
  previewUrl: string | null;
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

/** 영상 잠금 해제(결제) 응답 `data`. */
export type PinUnlockResult = {
  pinId: number;
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
