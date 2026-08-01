import type {
  PinPreview,
  RecommendationsQuery,
  RecommendationsResponse,
  RecommendedPlace,
} from '@/types/recommend';
import { MOCK_LATENCY_MS, delay } from './pin';

/**
 * 추천 장소 고정 데이터.
 *
 * 백엔드에 추천 컨트롤러가 아직 없어 화면을 이 데이터로 돌린다. 응답 모양은 명세를 그대로
 * 따르므로 서버가 생기면 값만 바뀐다.
 */

/** 카드 하나를 만드는 재료. 나머지 필드는 규칙으로 채운다. */
interface MockPlaceSeed {
  placeId: number;
  name: string;
  address: string;
  /** 상세 화면 지도가 찍을 좌표. 성동·광진구 일대의 대략적인 위치다. */
  latitude: number;
  longitude: number;
  /** 연락처. 공원·산책로처럼 받을 곳이 없으면 null이다. */
  phone: string | null;
  businessHoursText: string | null;
  /** 지금 열람할 수 있는 전체 핀 수. */
  activePinCount: number;
  /** 활성 핀을 쓴 사람 수. 감지카메라를 포함한다. */
  uploaderCount: number;
  /** 링에 그릴 각도. 첫 번째가 대표 업로더(감지카메라)다. */
  angles: number[];
}

const seeds: MockPlaceSeed[] = [
  { placeId: 1, name: '성수 연무장길', address: '서울 성동구 연무장길', latitude: 37.5427, longitude: 127.0559, phone: '02-462-1024', businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 13, uploaderCount: 9, angles: [320, 90, 270, 90, 180] },
  { placeId: 2, name: '서울숲 산책로', address: '서울 성동구 뚝섬로 273', latitude: 37.5444, longitude: 127.0374, phone: '02-460-2905', businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 12, uploaderCount: 8, angles: [90, 180, 320, 270, 90] },
  { placeId: 3, name: '뚝섬한강공원', address: '서울 광진구 강변북로 139', latitude: 37.5299, longitude: 127.0668, phone: null, businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 6, uploaderCount: 5, angles: [270, 90, 180, 320, 90] },
  { placeId: 4, name: '성수 카페거리', address: '서울 성동구 성수이로', latitude: 37.5447, longitude: 127.0561, phone: '02-499-3080', businessHoursText: '영업중 · 오후 11:00까지', activePinCount: 9, uploaderCount: 7, angles: [180, 320, 90, 90, 270] },
  { placeId: 5, name: '연무장길 팝업존', address: '서울 성동구 연무장길 24', latitude: 37.5412, longitude: 127.0552, phone: '02-461-7742', businessHoursText: '영업중 · 오후 8:00까지', activePinCount: 14, uploaderCount: 11, angles: [90, 270, 320, 180, 90] },
  { placeId: 6, name: '어린이대공원', address: '서울 광진구 능동로 216', latitude: 37.5487, longitude: 127.0819, phone: '02-450-9311', businessHoursText: '운영중 · 오후 10:00까지', activePinCount: 5, uploaderCount: 4, angles: [320, 180, 90, 270, 90] },
  { placeId: 7, name: '건대 커먼그라운드', address: '서울 광진구 아차산로 200', latitude: 37.5410, longitude: 127.0687, phone: '02-467-2747', businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 11, uploaderCount: 6, angles: [90, 90, 180, 320, 270] },
  { placeId: 8, name: '송정제방길', address: '서울 성동구 송정동 73-448', latitude: 37.5486, longitude: 127.0714, phone: null, businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 3, uploaderCount: 3, angles: [270, 320, 90] },
  { placeId: 9, name: '성수 수제화거리', address: '서울 성동구 연무장7길', latitude: 37.5397, longitude: 127.0570, phone: '02-464-1114', businessHoursText: '영업중 · 오후 9:00까지', activePinCount: 7, uploaderCount: 6, angles: [180, 90, 270, 90, 320] },
  { placeId: 10, name: '서울숲 북쪽 산책로', address: '서울 성동구 서울숲2길', latitude: 37.5471, longitude: 127.0413, phone: null, businessHoursText: null, activePinCount: 10, uploaderCount: 7, angles: [90, 320, 90, 270, 180] },
  // 감지카메라만 올린 장소. 카드의 빈 상태를 확인할 수 있게 둔다.
  { placeId: 11, name: '바나프레소 역삼1점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', latitude: 37.5556, longitude: 127.0791, phone: '02-3436-1105', businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 1, uploaderCount: 1, angles: [90] },
];

/** 갱신 시각을 만들 때 거슬러 올라가는 분. 문자열로 박아 두면 시간이 지나도 그대로 남는다. */
const UPDATED_MINUTES_AGO = 16;

/** 대표 업로더. 명세 예시를 그대로 쓴다. */
const REPRESENTATIVE_NICKNAME = '감지카메라';

/** 핀 미리보기 상한. 명세가 최대 5개로 정하고 있다. */
const MAX_PIN_PREVIEWS = 5;

function toPlace(seed: MockPlaceSeed): RecommendedPlace {
  const pinPreviews: PinPreview[] = seed.angles
    .slice(0, MAX_PIN_PREVIEWS)
    .map((angle, index) => ({
      // 장소마다 겹치지 않도록 장소 번호를 앞에 붙인다.
      pinId: seed.placeId * 100 + index + 1,
      uploaderViewReliability: angle,
    }));

  return {
    placeId: seed.placeId,
    name: seed.name,
    address: seed.address,
    latitude: seed.latitude,
    longitude: seed.longitude,
    phone: seed.phone,
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

  const places = seeds.map(toPlace);
  const limit = query.limit ?? places.length;

  // 핀이 적은 곳을 여유, 많은 곳을 와글로 나눈다. 실제로는 서버가 혼잡도로 정한다.
  const quiet = places.filter((place) => place.activePinCount <= 9);
  const busy = places.filter((place) => place.activePinCount > 9);

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
