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

/** 평가 버튼이 보내는 값. 서버는 완료 여부(`isEvaluated`)만 돌려주고 어느 쪽인지는 알려주지 않는다. */
export type PinRating = 'HELPFUL' | 'MISS';

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
 * `GET /api/v1/pins/{pinId}` 응답 `data`.
 *
 * 서버 응답을 그대로 옮긴 계약 타입이다. 화면 편의를 위한 파생값은 넣지 않고
 * 아래 헬퍼(`isOwnPin` 등)로 판정한다.
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
