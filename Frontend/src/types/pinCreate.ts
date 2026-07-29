import type { CrowdLevelKey, CrowdLevelValue } from '@/constants/crowdLevels';
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

/** 상세 위치 최대 길이. */
export const MAX_DETAIL_LOCATION_LENGTH = 100;

/**
 * `POST /api/v1/pins` 요청 본문.
 *
 * `crowdLevel`은 `CrowdLevelKey`(`QUIET`·`NOT_CROWDED`·`CROWDED`·`VERY_CROWDED`)와 값이 같아
 * 별도 변환이 없다. 상세 조회 응답의 enum과는 표기가 다르다.
 *
 * `latitude`·`longitude`는 촬영 좌표이며 선택한 장소와 20m 이내여야 한다.
 * 선택 항목은 비어 있으면 보내지 않는다.
 */
export interface PinCreateRequest {
  /** 외부 스토리지에 업로드한 뒤 받은 접근 가능한 URL. */
  videoUrl: string;
  placeId: number;
  latitude: number;
  longitude: number;
  crowdLevel: CrowdLevelKey;
  detailLocation?: string;
  memo?: string;
  tags?: string[];
}

/** 접수된 핀의 처리 상태. AI 검수를 통과하면 `ACTIVE`가 된다. */
export type PinProcessingStatus = 'PROCESSING' | 'ACTIVE';

/** `POST /api/v1/pins` 응답의 `data`. 202로 접수만 되고 처리는 비동기다. */
export interface PinCreateResult {
  pinId: number;
  status: PinProcessingStatus;
}
