import { apiRequest } from '../client';
import { usesMock } from '../config';
import { fetchMockPinDetail } from '@/mocks/pin';
import { revealsVideo } from '@/types/pin';
import { tracePin } from './log';
import type { PinDetailResponse, PinId } from '@/types/pin';

/**
 * 핀 카드 썸네일 주소 발급.
 *
 * **장소 상세의 핀 목록에는 볼 수 있는 썸네일이 오지 않는다.** 서버가 `thumbnailKey`에 S3
 * 객체 키를 그대로 담아 주는데(`PinCardAssembler`), 그 값은 `Image`에 넘겨도 그려지지 않아
 * `api/place/detail.ts`가 경계에서 걸러 null로 만든다. 그래서 카드마다 색 자리만 남았다.
 *
 * 키를 볼 수 있는 주소로 바꿔 주는 곳은 **핀 상세(`GET /api/v1/pins/{pinId}`)** 하나뿐이다.
 * 거기서는 `PinDetailService`가 요청 시점마다 Presigned GET URL을 발급한다. 열람(결제) 여부와
 * 무관하게 발급되므로(가려진 것은 영상이 아니라 **블러 처리된 영상 자체**다) 목록의 카드도
 * 이 주소를 그대로 쓸 수 있다.
 *
 * **접근 수준(`videoAccess`)도 같은 응답에서 받아 온다.** 썸네일은 현장 영상의 한 장면이라
 * 결제하지 않은 사람에게는 상세 화면과 같은 기준으로 가려야 하는데, 목록의 카드에는 그것을
 * 판정할 값이 없다 — `isUnlocked`는 결제 기록이라 작성자 본인도 false다. 어차피 부르는
 * 조회에 들어 있으므로 주소와 함께 담아 보낸다.
 *
 * 그래서 카드 하나에 상세 조회 하나를 쓴다. 값이 비싸므로 세 가지를 지킨다.
 * - **발급받은 주소를 만료 전까지 재사용한다**(아래 `cache`)
 * - 같은 핀을 동시에 여러 번 묻지 않는다(`inFlight`)
 * - 한 번에 너무 많이 보내지 않는다(`MAX_CONCURRENCY`)
 *
 * 서버가 카드 조립기에서도 Presigned URL을 주기 시작하면 이 파일을 부르는 쪽
 * (`features/place-detail/hooks/usePinThumbnails.ts`)만 지우면 된다 — 그때는 첫 응답에
 * 이미 주소가 들어 있어 여기까지 오지 않는다.
 */

/**
 * 발급 주소의 남은 수명에서 미리 빼 두는 여유.
 *
 * 만료 직전에 꺼내 쓰면 `Image`가 받아 오는 사이에 서명이 죽어 빈 자리가 된다.
 */
const EXPIRY_MARGIN_MS = 30_000;

/** 수명을 읽지 못했을 때 쓰는 값. 서버 기본값(600초)보다 짧게 잡아 안전한 쪽으로 둔다. */
const FALLBACK_TTL_MS = 5 * 60_000;

/**
 * 주소를 받지 못한 핀을 다시 묻기까지 기다리는 시간.
 *
 * 실패가 잦은 쪽은 **공개 전(PENDING)·삭제된 핀**이다. 그런 핀이 목록에 섞여 오는데
 * (백엔드에 요청해 둔 항목) 상세는 `ACTIVE`만 답하므로 `PIN_NOT_FOUND`가 된다. 매번 다시
 * 물으면 카드 수만큼의 실패 요청이 화면을 그릴 때마다 되풀이된다.
 */
const MISS_TTL_MS = 60_000;

/** 동시에 보내는 상세 조회 수. 목록 하나가 열 장이어도 서버에 한꺼번에 몰리지 않는다. */
const MAX_CONCURRENCY = 3;

/** 카드 한 장에 그릴 썸네일. */
export interface PinThumbnail {
  /** 발급받은 주소. */
  url: string;
  /**
   * 가리지 않고 보여줘도 되는지. 작성자 본인이거나 열람한 핀이면 참이다.
   *
   * 거짓이면 화면이 블러로 가린다 — 상세의 영상과 같은 기준이다(`revealsVideo`).
   */
  revealed: boolean;
}

interface CacheEntry {
  /** 받은 썸네일. 받지 못했으면 null. */
  thumbnail: PinThumbnail | null;
  /** 이 시각이 지나면 다시 묻는다. */
  expiresAt: number;
}

const cache = new Map<PinId, CacheEntry>();

/** 지금 답을 기다리고 있는 조회. 같은 핀을 두 번 묻지 않게 붙잡아 둔다. */
const inFlight = new Map<PinId, Promise<PinThumbnail | null>>();

/**
 * 발급 주소를 얼마나 재사용할 수 있는지.
 *
 * Presigned URL은 서명 수명을 `X-Amz-Expires`(초)에 담고 있어 서버 설정을 프론트에 적어 두지
 * 않아도 된다. **받은 시각을 기준으로 센다** — 서명 시각(`X-Amz-Date`)은 서버 시계라 기기
 * 시계와 어긋나면 이미 만료된 것으로 읽힌다.
 */
function reuseWindowOf(url: string): number {
  const seconds = /[?&]X-Amz-Expires=(\d+)/.exec(url);
  if (seconds === null) return FALLBACK_TTL_MS;

  return Math.max(0, Number(seconds[1]) * 1000 - EXPIRY_MARGIN_MS);
}

/** 핀 상세에서 썸네일에 필요한 것만 꺼낸다. */
async function requestThumbnail(pinId: PinId): Promise<PinThumbnail | null> {
  const detail = usesMock('pin/detail')
    ? await fetchMockPinDetail(pinId)
    : await apiRequest<PinDetailResponse>({ method: 'GET', url: `/api/v1/pins/${pinId}` });

  if (detail.thumbnailUrl === null) return null;

  return { url: detail.thumbnailUrl, revealed: revealsVideo(detail.videoAccess) };
}

/**
 * 핀 하나의 썸네일. 실패하면 null로 답한다.
 *
 * **던지지 않는다.** 카드 열 장 중 하나가 삭제된 핀이라고 해서 나머지 아홉 장의 썸네일이
 * 함께 비어서는 안 된다.
 */
function resolveOne(pinId: PinId): Promise<PinThumbnail | null> {
  const cached = cache.get(pinId);
  if (cached !== undefined && cached.expiresAt > Date.now()) return Promise.resolve(cached.thumbnail);

  const pending = inFlight.get(pinId);
  if (pending !== undefined) return pending;

  const request = requestThumbnail(pinId)
    .then((thumbnail) => {
      cache.set(pinId, {
        thumbnail,
        expiresAt: Date.now() + (thumbnail === null ? MISS_TTL_MS : reuseWindowOf(thumbnail.url)),
      });
      return thumbnail;
    })
    .catch(() => {
      cache.set(pinId, { thumbnail: null, expiresAt: Date.now() + MISS_TTL_MS });
      return null;
    })
    .finally(() => inFlight.delete(pinId));

  inFlight.set(pinId, request);
  return request;
}

/**
 * 핀 여러 개의 썸네일을 모아서 받는다.
 *
 * 받은 것만 담아 답한다 — 실패한 핀은 키 자체가 없으므로, 부르는 쪽은 "아직 없음"과 "받지
 * 못함"을 같은 자리(빈 썸네일)로 다룰 수 있다.
 *
 * 앞에 적은 순서대로 처리한다. 화면 맨 위 카드부터 채워지는 편이 눈에 자연스럽다.
 */
export function getPinThumbnails(pinIds: PinId[]): Promise<Map<PinId, PinThumbnail>> {
  const resolved = new Map<PinId, PinThumbnail>();
  if (pinIds.length === 0) return Promise.resolve(resolved);

  return tracePin(
    '카드 썸네일',
    'pin/detail',
    async () => {
      const queue = [...pinIds];

      /*
        일꾼 몇 명이 같은 줄에서 하나씩 꺼내 간다. 앞엣것이 끝나기를 기다리지 않으므로
        느린 핀 하나가 뒤를 막지 않는다.
      */
      const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, async () => {
        for (let pinId = queue.shift(); pinId !== undefined; pinId = queue.shift()) {
          const thumbnail = await resolveOne(pinId);
          if (thumbnail !== null) resolved.set(pinId, thumbnail);
        }
      });

      await Promise.all(workers);
      return resolved;
    },
    (thumbnails) => ({
      요청: pinIds.length,
      발급: thumbnails.size,
      선명: [...thumbnails.values()].filter((thumbnail) => thumbnail.revealed).length,
    }),
  );
}
