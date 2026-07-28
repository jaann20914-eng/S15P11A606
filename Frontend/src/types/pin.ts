import type { CrowdLevelKey } from '@/constants/crowdLevels';

/**
 * 핀 처리 상태.
 *
 * 2026-07-28 기준 DB(`PENDING/PROCESSING/COMPLETED/FAILED`)와
 * API 명세(`PROCESSING/ACTIVE/RESHOOT`)의 값이 서로 달라 확정되지 않았다.
 * 백엔드 답변 후 정리한다.
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

/** 영상핀 평가. 열람한 사용자만 한 번 남길 수 있다. */
export type PinRating = 'HELPFUL' | 'MISS';

/**
 * 상세 화면이 구분하는 채팅방 상태.
 *
 * `chat_room.status` enum이 문서마다 달라(API 명세 `PENDING/ACTIVE/CLOSED` vs
 * DB `ACTIVE/REFUSED/LEFT`) 아직 확정되지 않았다. 상세 화면은 "요청 가능 / 수락 대기 /
 * 입장 가능" 세 가지만 구분하면 되므로 확정 전까지 이 최소 집합으로 다룬다.
 */
export type PinChatStatus = 'PENDING' | 'ACTIVE' | 'CLOSED';

/** 핀 작성자 중 상세 화면에 공개되는 정보. 익명 정책이 적용된 값이다. */
export type PinAuthor = {
  nickname: string;
  /** 공개 뷰 온도. 프로필 링에 표시한다. */
  viewTemperature: number;
  /** 신뢰도 상위 백분율. 산출 대상이 아니면 null. */
  trustPercentile: number | null;
};

/**
 * 현재 사용자 기준 상태. 블러 · 결제 버튼 · 평가 · 삭제 분기가 전부 여기에 달려 있다.
 * 서버가 뷰어별로 계산해 내려줘야 하며 프론트가 유추할 수 없다.
 */
export type PinViewerState = {
  /** 내가 작성한 핀인지. true면 결제·채팅 대신 삭제를 노출한다. */
  isMine: boolean;
  /** 크레딧을 써서 영상을 열람했는지. false면 블러를 유지한다. */
  isPurchased: boolean;
  /** 이미 남긴 평가. 없으면 null. */
  myRating: PinRating | null;
  /** 이 핀으로 만든 채팅방. 아직 요청하지 않았으면 null. */
  chatRoomId: number | null;
  chatStatus: PinChatStatus | null;
};

/** 게시글 상세 보기 화면이 필요한 전체 데이터. */
export type PinDetail = {
  pinId: number;
  placeId: number;
  placeName: string;
  address: string;
  /** 블러 해제된 원본 영상. 미열람이면 서버가 내려주지 않는다. */
  videoUrl: string | null;
  /** 미열람 상태에서도 블러 처리해 노출하는 썸네일. */
  thumbnailUrl: string;
  memo: string;
  tags: string[];
  crowdLevel: CrowdLevelKey;
  capturedAt: string;
  expiresAt: string;
  status: PinStatus;
  author: PinAuthor;
  viewer: PinViewerState;
};
