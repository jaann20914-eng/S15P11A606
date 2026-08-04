import type {
  PinPreview,
  RecommendationsQuery,
  RecommendationsResponse,
  RecommendedPlace,
} from '@/types/recommend';
import { MOCK_LATENCY_MS, delay, mockPinId } from './pin';
import {
  averageCrowdLevelOf,
  mockPlaceSeeds,
  REPRESENTATIVE_NICKNAME,
  WAGLE_FROM_LEVEL,
  type MockPlaceSeed,
} from './placeSeeds';

/**
 * 추천 장소 고정 데이터.
 *
 * 백엔드에 추천 컨트롤러가 아직 없어 화면을 이 데이터로 돌린다. 응답 모양은 명세를 그대로
 * 따르므로 서버가 생기면 값만 바뀐다.
 *
 * 장소 자체는 `placeSeeds`에서 가져온다. 추천에서 누른 카드와 장소 상세(`/places/{placeId}`)가
 * 같은 장소를 보여줘야 하기 때문이다.
 */

/** 갱신 시각을 만들 때 거슬러 올라가는 분. 문자열로 박아 두면 시간이 지나도 그대로 남는다. */
const UPDATED_MINUTES_AGO = 16;

/** 핀 미리보기 상한. 명세가 최대 5개로 정하고 있다. */
const MAX_PIN_PREVIEWS = 5;

function toPlace(seed: MockPlaceSeed): RecommendedPlace {
  const pinPreviews: PinPreview[] = seed.pins.slice(0, MAX_PIN_PREVIEWS).map((pin, index) => ({
    // 장소마다 겹치지 않도록 장소 번호를 앞에 붙여 UUID 모양으로 만든다.
    pinId: mockPinId(seed.placeId * 100 + index + 1),
    uploaderViewAngle: pin.viewAngle,
  }));

  return {
    placeId: seed.placeId,
    name: seed.name,
    address: seed.address,
    // 명세에는 아직 없다. 상세 화면이 좌표를 넘겨받는 경로를 확인할 수 있게 목업은 넣어 둔다.
    latitude: seed.latitude,
    longitude: seed.longitude,
    businessStatus: seed.businessHoursText === null ? 'UNKNOWN' : 'OPEN',
    businessHoursText: seed.businessHoursText,
    activePinCount: seed.activePinCount,
    uploaderCount: seed.uploaderCount,
    representativeUploaderNickname: REPRESENTATIVE_NICKNAME,
    pinPreviews,
  };
}

/**
 * 개인화 장소 추천 목업.
 *
 * 명세대로 두 목록을 한 번에 준다. 같은 장소가 양쪽에 들어가지 않도록 나눠 담는다 —
 * 그렇지 않으면 토글이 바뀐 것을 화면에서 확인할 수 없다.
 *
 * 좌표를 받으면 `CURRENT_GPS`, 없으면 `CACHED_GPS`로 답한다. 위치 출처에 따라 화면이
 * 달라지는지 확인할 수 있게 두 경우를 모두 만든다.
 */
export async function fetchMockRecommendations(
  query: RecommendationsQuery,
): Promise<RecommendationsResponse> {
  await delay(MOCK_LATENCY_MS);

  const generatedAt = new Date();
  generatedAt.setMinutes(generatedAt.getMinutes() - UPDATED_MINUTES_AGO);

  const limit = query.limit ?? mockPlaceSeeds.length;

  /*
    계열은 **혼잡도로 나눈다.** 명세대로 평균 혼잡 단계 3.0부터가 와글이다.

    예전에는 핀 수로 나눴는데(9개 초과면 와글), 핀 수를 실제 목록 길이에 맞추면서 모든 장소가
    한쪽으로 몰려 와글 목록이 비어 버렸다. 핀이 많다고 붐비는 것도 아니라 기준 자체가 틀렸다.

    한 장소는 한쪽에만 들어간다(명세). 그래서 같은 기준으로 한 번에 갈라 놓는다.
  */
  const isWagle = (seed: MockPlaceSeed) => (averageCrowdLevelOf(seed) ?? 0) >= WAGLE_FROM_LEVEL;
  const quiet = mockPlaceSeeds.filter((seed) => !isWagle(seed)).map(toPlace);
  const busy = mockPlaceSeeds.filter(isWagle).map(toPlace);

  return {
    locationSource: query.latitude !== undefined ? 'CURRENT_GPS' : 'CACHED_GPS',
    recommendationType: 'PERSONALIZED',
    generatedAt: generatedAt.toISOString(),
    recommendations: {
      relaxed: quiet.slice(0, limit),
      wagle: busy.slice(0, limit),
    },
  };
}
