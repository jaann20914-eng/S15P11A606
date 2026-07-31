import type { CrowdLevelValue } from '@/constants/crowdLevels';
import type { PinCrowdLevel } from '@/types/pin';
import type { PlaceSearchItem } from '@/types/place';

/**
 * 게시글 작성 화면의 진입 유형.
 *
 * 새로 쓰는 것과 기존 핀을 고치는 것이 같은 화면을 쓴다. 제목·버튼 문구·초기값·제출 API가
 * 갈리므로 화면은 이 값 하나만 보고 분기한다.
 */
export type PinCreateMode = { type: 'create' } | { type: 'edit'; pinId: number };

/** 촬영한 영상. 아직 촬영 전이면 null이다. */
export interface PinDraftVideo {
  /** 기기 파일 경로(`file://`). 업로드할 때 그대로 쓴다. */
  uri: string;
  /** 실제 녹화된 길이(초). 최대 길이를 넘겼는지 확인하는 데 쓴다. */
  durationSeconds: number;
}

/** 작성 화면이 들고 있는 입력값 전체. 제출 직전에 요청 본문으로 바뀐다. */
export interface PinDraft {
  crowdLevel: CrowdLevelValue;
  video: PinDraftVideo | null;
  memo: string;
  tags: string[];
  /** 선택한 장소. 검색 결과에서 고르기 전에는 null이다. */
  place: PinDraftPlace | null;
  detailLocation: string;
}

/**
 * 장소 검색 결과에서 선택한 항목.
 *
 * 카카오 장소이므로 내부 `placeId`가 아닌 `kakaoPlaceId`로 식별한다.
 * 좌표까지 들고 있어야 등록 요청에 그대로 실을 수 있다.
 */
export type PinDraftPlace = PlaceSearchItem;

/** 영상 최대 길이(초). 이 시간이 지나면 녹화가 자동으로 멈춘다. */
export const MAX_VIDEO_SECONDS = 5;

/** 내용 입력 최대 길이. */
export const MAX_MEMO_LENGTH = 50;

/** 태그 최대 개수. */
export const MAX_TAG_COUNT = 3;

/** 태그 하나의 최대 길이. 앞뒤 공백을 지운 뒤 1자 이상이어야 한다. */
export const MAX_TAG_LENGTH = 30;

/** 상세 위치 최대 길이. */
export const MAX_DETAIL_LOCATION_LENGTH = 100;

/** 촬영 좌표와 선택한 장소 사이에 허용되는 거리. 서버가 검증한다. */
export const MAX_PLACE_DISTANCE_METERS = 50;

/** 촬영 영상의 MIME. Presigned URL 서명에 포함될 수 있어 업로드 때도 같은 값을 보낸다. */
export const VIDEO_CONTENT_TYPE = 'video/mp4';

/**
 * 업로드 한 건에 필요한 정보.
 *
 * Presigned POST 방식이다. 서명이 URL이 아니라 `fields`에 담기므로 `uploadUrl`은 버킷 주소이고
 * 객체 경로는 `fields.key`가 갖는다. 업로드는 `fields`를 그대로 실은 `multipart/form-data`
 * `POST`로 보낸다.
 *
 * `fields`의 키 이름과 개수는 서버가 정한다. 프론트는 해석하지 않고 폼에 옮겨 담기만 한다.
 * 등록 API에는 URL이 아니라 `originalVideoKey`만 보낸다.
 */
export interface VideoUploadTicket {
  uploadUrl: string;
  originalVideoKey: string;
  fields: Record<string, string>;
}

/**
 * 등록 진행 상태. 진행 화면이 이 값으로 문구와 퍼센트를 고른다.
 *
 * `registering`까지는 프론트가 요청을 보내는 단계다. `processing`은 서버가 접수한 뒤
 * AI 블러 처리를 기다리는 단계이고, `done`은 처리까지 끝나 공개 가능한 상태다.
 */
export type VideoUploadPhase = 'idle' | 'issuing' | 'uploading' | 'registering' | 'processing' | 'done';

/** 상태 조회 주기. 명세에 미정이라 우선 정한 값이다. */
export const STATUS_POLL_INTERVAL_MS = 2_000;

/** 상태 조회를 포기하는 시점. 이 시간을 넘기면 접수됐다는 안내만 남긴다. */
export const STATUS_POLL_TIMEOUT_MS = 60_000;

/** `GET /api/v1/pins/{pinId}/status` 응답의 `data`. */
export interface PinStatusResult {
  pinId: number;
  videoStatus: PinVideoStatus;
}

/**
 * `POST /api/v1/pins` 요청 본문.
 *
 * 영상 자체도, 영상 URL도 보내지 않는다. Presigned URL로 외부 스토리지에 업로드한 뒤
 * 받은 객체 키만 보낸다.
 *
 * `crowdLevel`은 서버 enum(`WAGLE_WAGLE`·`WAGLE`·`RELAXED`·`LEISURELY`)으로 보낸다.
 * 프론트 토큰(`CrowdLevelKey`)과 표기가 달라 `toServerCrowdLevel`로 변환한다.
 *
 * `latitude`·`longitude`는 촬영 좌표이며 선택한 장소와 50m 이내여야 한다.
 * 선택 항목은 비어 있으면 보내지 않는다.
 */
export interface PinCreateRequest {
  /** Back이 발급한 원본 영상 객체 키. URL이 아니다. 최대 1024자. */
  originalVideoKey: string;
  /**
   * 선택한 장소의 카카오 식별자.
   *
   * 장소 검색은 카카오 결과를 중계만 하고 `Place`를 저장하지 않아 내부 `placeId`가 없다.
   * 백엔드 확인 결과 둘은 같은 값이며 등록 요청은 이 이름을 쓴다.
   */
  kakaoPlaceId: string;
  /**
   * 선택한 장소의 이름과 주소.
   *
   * 서버가 등록 시점에 `Place`를 새로 저장한다. 카카오는 식별자로 단건 조회하는 API가 없어
   * 검색 결과에서 받은 값을 프론트가 그대로 되돌려준다. 필드 이름은 백엔드 확정 전 가정값이다.
   */
  placeName: string;
  placeAddress: string;
  latitude: number;
  longitude: number;
  crowdLevel: PinCrowdLevel;
  detailLocation?: string;
  memo?: string;
  tags?: string[];
}

/**
 * 영상 처리 상태. 백엔드 `VideoStatus` enum과 값을 맞춘다.
 *
 * 접수 시 `PENDING`이고 AI 처리를 거쳐 갈린다. `COMPLETED`만 공개된다.
 * `FAILED`는 검수 탈락과 시스템 오류를 함께 담는다.
 */
export type PinVideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * `POST /api/v1/pins` 응답의 `data`.
 *
 * 202로 접수만 된다. 블러 영상 URL은 여기서 주지 않고 이후 상세·상태 조회에서 받는다.
 */
export interface PinCreateResult {
  pinId: number;
  videoStatus: PinVideoStatus;
}
