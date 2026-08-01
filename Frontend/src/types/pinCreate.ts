import type { CrowdLevelValue } from '@/constants/crowdLevels';
import type { PinId, PinCrowdLevel } from '@/types/pin';
import type { PlaceSearchItem } from '@/types/place';
import type { Coordinate } from '@/store/useMapStore';

/**
 * 게시글 작성 화면의 진입 유형.
 *
 * 새로 쓰는 것과 기존 핀을 고치는 것이 같은 화면을 쓴다. 제목·버튼 문구·초기값·제출 API가
 * 갈리므로 화면은 이 값 하나만 보고 분기한다.
 */
export type PinCreateMode = { type: 'create' } | { type: 'edit'; pinId: PinId };

/** 촬영한 영상. 아직 촬영 전이면 null이다. */
export interface PinDraftVideo {
  /** 기기 파일 경로(`file://`). 업로드할 때 그대로 쓴다. */
  uri: string;
  /** 실제 녹화된 길이(초). 최대 길이를 넘겼는지 확인하는 데 쓴다. */
  durationSeconds: number;
  /**
   * 촬영한 자리의 좌표. 등록 요청의 `latitude`·`longitude`가 이 값이다.
   *
   * 장소 좌표가 아니라 **찍은 자리**여야 한다. 서버가 둘 사이 거리를 재서 50m를 넘으면
   * 거절한다(`LOCATION_OUT_OF_RANGE`). 촬영 시점에 위치를 얻지 못했으면 null이고, 그때는
   * 등록 직전에 다시 읽는다.
   */
  coordinate: Coordinate | null;
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
 * 등록에서 고른 장소. 카카오 검색 결과 그대로다.
 *
 * 내부 `placeId`가 아닌 `kakaoPlaceId`로 식별한다. 그 장소가 우리 DB에 없을 수 있고,
 * 등록 시점에 서버가 만들기 때문이다. 좌표까지 들고 있어야 등록 요청에 실을 수 있다.
 */
export interface KakaoDraftPlace extends PlaceSearchItem {
  source: 'kakao';
}

/**
 * 수정에서 고른 장소. 우리 DB에 이미 있는 것이다.
 *
 * 수정 API는 **내부 식별자만** 받는다(`placeId`). 그래서 카카오 검색이 아니라 장소 목록
 * (`GET /api/v1/places`)에서 고른다. 자세한 사정은 `toPinUpdateRequest` 주석에 있다.
 */
export interface InternalDraftPlace {
  source: 'internal';
  placeId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * 작성 화면이 들고 있는 장소.
 *
 * 등록과 수정이 서로 다른 식별자를 쓰기 때문에 갈라 둔다. 어느 쪽인지 모른 채 값을 꺼내
 * 쓰면, 수정 요청에 카카오 식별자를 실어 보내는 것 같은 실수가 컴파일에서 걸리지 않는다.
 */
export type PinDraftPlace = KakaoDraftPlace | InternalDraftPlace;

/**
 * 아무것도 입력하지 않은 상태.
 *
 * 작성 폼의 초기값이자, 수정에서 "불러온 값"을 채울 바탕이다. 두 곳이 같은 것을 써야 비교가
 * 어긋나지 않는다 — 수정은 시작값과 지금 값을 견줘 바뀐 것만 보낸다.
 */
export const EMPTY_PIN_DRAFT: PinDraft = {
  crowdLevel: 1,
  video: null,
  memo: '',
  tags: [],
  place: null,
  detailLocation: '',
};

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
 * 업로드 한 건에 필요한 정보. `POST /api/v1/pins/upload-url` 응답의 `data`다.
 *
 * **Presigned PUT 방식이다.** 서명이 URL 자체에 들어 있어 별도의 폼 필드가 없다. 발급 요청에
 * 실은 것과 같은 `Content-Type`으로 그 URL에 PUT 한 번을 보내면 된다.
 *
 * 등록 API에는 URL이 아니라 `originalVideoKey`만 보낸다. 이 키는 핀 하나에만 쓸 수 있고,
 * 같은 `uploadUrl`을 다시 쓰지 않는다.
 */
export interface VideoUploadTicket {
  uploadUrl: string;
  /** 원본 영상 객체 키. 최대 1024자. 등록 요청에 그대로 넘긴다. */
  originalVideoKey: string;
  /** URL 만료 시각(ISO 8601). 지나면 다시 발급받아야 한다. */
  expiresAt: string;
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

/**
 * 영상 교체 작업의 상태. 수정에서 영상을 바꿨을 때만 값이 있다.
 *
 * 공개 중인 영상의 상태(`videoStatus`)와 **별개다.** 교체가 도는 동안에도 기존 영상은 계속
 * 공개되므로 `videoStatus`는 `ACTIVE`로 남는다.
 *
 * - `PENDING` AI 처리 중
 * - `PASS` 통과. 새 영상으로 교체됐다
 * - `FAIL` 검수 탈락. **기존 영상이 그대로 남는다**
 * - `FAILED` AI·시스템 오류. 이때도 기존 영상은 그대로다
 */
export type VideoReplacementStatus = 'PENDING' | 'PASS' | 'FAIL' | 'FAILED';

/**
 * `GET /api/v1/pins/{pinId}/status` 응답의 `data`.
 *
 * 두 URL은 `ACTIVE`이고 영상이 만료되지 않았을 때만 온다. 그 외 상태에서는 null이다.
 * 객체 키는 프론트에 오지 않는다 — 서버가 Presigned GET URL로 바꿔 준다.
 */
export interface PinStatusResult {
  pinId: PinId;
  videoStatus: PinVideoStatus;
  /** 얼굴 블러 영상. */
  videoUrl: string | null;
  /** 얼굴 블러 썸네일. */
  thumbnailUrl: string | null;
  /** 진행 중이거나 마지막으로 끝난 교체 작업. 교체한 적이 없으면 null. */
  videoReplacementStatus?: VideoReplacementStatus | null;
}

/**
 * `PATCH /api/v1/pins/{pinId}` 요청 본문.
 *
 * **부분 수정이다.** 보낸 필드만 바뀌고 생략한 필드는 그대로 남는다. 그래서 값을 지우는 것과
 * 건드리지 않는 것을 구분해야 한다 — `detailLocation`·`memo`는 `null`을 보내면 지워지고,
 * `tags`는 빈 배열을 보내면 모두 지워진다. 하나도 보내지 않으면 서버가 400으로 막는다.
 *
 * 좌표는 둘을 함께 보낸다. 하나만 보내면 거절된다.
 *
 * `originalVideoKey`를 실으면 영상 교체가 시작된다. 그 요청의 응답은 202이고, 기존 영상은
 * 검수가 끝날 때까지 그대로 공개된다.
 *
 * 장소 변경(`placeId`)은 **이 화면에서 보내지 않는다.** 서버가 내부 식별자만 받는데 우리 장소
 * 검색은 카카오 식별자를 주기 때문이다. 자세한 이유는 `toPinUpdateRequest` 주석에 있다.
 */
export interface PinUpdateRequest {
  originalVideoKey?: string;
  /** 서비스에 이미 있는 내부 장소 식별자. 카카오 식별자가 아니다. */
  placeId?: number;
  /** 촬영 좌표. 둘을 함께 보낸다. 최종 장소와 50m 이내여야 한다. */
  latitude?: number;
  longitude?: number;
  /** `null`이면 기존 값을 지운다. */
  detailLocation?: string | null;
  crowdLevel?: PinCrowdLevel;
  /** `null`이면 기존 값을 지운다. */
  memo?: string | null;
  /** 빈 배열이면 태그를 모두 지운다. */
  tags?: string[];
}

/**
 * `PATCH /api/v1/pins/{pinId}` 응답의 `data`.
 *
 * 일반 정보만 고치면 200, 영상 교체가 끼면 202다. 둘 다 이 모양으로 온다.
 */
export interface PinUpdateResult {
  pinId: PinId;
  /** 공개 중인 영상의 상태. 교체 중에도 `ACTIVE`를 유지한다. */
  videoStatus: PinVideoStatus;
  /** 영상 교체를 요청했을 때만 온다. 접수 시 `PENDING`. */
  videoReplacementStatus?: VideoReplacementStatus | null;
  /** 곧바로 반영된 필드. 영상만 바꿨으면 빈 배열이다. */
  updatedFields: string[];
  /** 비동기로 처리 중인 필드. 영상 교체면 `originalVideoKey`가 들어온다. */
  pendingFields?: string[];
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
   * 선택한 장소의 이름과 좌표.
   *
   * 서버가 그 장소를 아직 저장하지 않았을 때 만드는 데 참고한다. **최종값으로 쓰이지는
   * 않는다** — 서버는 `kakaoPlaceId`로 카카오 장소 API나 기존 `places`에서 다시 확인하고,
   * 거리 검증도 그 좌표로 한다.
   */
  placeName: string;
  kakaoPlaceLatitude: number;
  kakaoPlaceLongitude: number;
  /** 영상을 찍은 자리의 좌표. 장소 좌표와 50m 이내여야 한다. */
  latitude: number;
  longitude: number;
  crowdLevel: PinCrowdLevel;
  detailLocation?: string;
  memo?: string;
  tags?: string[];
}

/**
 * 영상 처리 상태. 백엔드 `pins.video_status`와 값을 맞춘다.
 *
 * 접수 시 `PENDING`이고 AI 블러·검수를 거쳐 갈린다.
 * - `ACTIVE` 통과. 공개되고 이때만 영상·썸네일 URL이 온다
 * - `REJECTED` 검수 기준 미충족. 자동 재처리는 없고 화면이 재촬영을 안내한다
 * - `FAILED` AI 또는 시스템 오류
 *
 * 셋 중 하나가 오면 폴링을 멈춘다.
 */
export type PinVideoStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'FAILED';

/**
 * `POST /api/v1/pins` 응답의 `data`.
 *
 * 202로 접수만 된다. 블러 영상 URL은 여기서 주지 않고 이후 상세·상태 조회에서 받는다.
 */
export interface PinCreateResult {
  pinId: PinId;
  videoStatus: PinVideoStatus;
}
