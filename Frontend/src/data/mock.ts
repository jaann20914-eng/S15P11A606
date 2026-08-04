import { colors } from '@/constants/theme';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';
import { averageCrowdLevelOf, mockPlaceSeeds } from '@/mocks/placeSeeds';

export type MockPlace = {
  id: string;
  name: string;
  address: string;
  /** 최근 1시간 유효 핀의 평균 혼잡 단계 (1~4) */
  crowdLevel: CrowdLevelValue;
  pins: number;
  /**
   * 카드에 링으로 보여줄 작성자들의 뷰 각도. 최대 5개만 그리고 나머지는 `+n`으로 적는다.
   *
   * 실제 연동 시 `/places` 응답의 `activePins[].viewAngle`로 그대로 대체된다.
   * 값이 제각각이어야 링 채움 비율이 달라 보인다 — 같은 각도만 넣으면 링이 아무 정보를 주지 않는다.
   */
  angles: number[];
  /** 화면에 그리지 않는 값이다. 세 곳에만 남아 있어 선택으로 둔다. */
  distance?: string;
  tag?: string;
  /** 지도 핀 좌표 (WGS84). 실제 연동 시 `/places` 응답의 좌표로 대체한다. */
  latitude: number;
  longitude: number;
};

export const places: MockPlace[] = [
  {
    id: '1',
    name: '성수 연무장길',
    address: '서울 성동구 연무장길',
    crowdLevel: 1,
    pins: 8,
    angles: [320, 90, 250, 140, 200],
    distance: '620m',
    tag: '팝업 · 카페',
    latitude: 37.5427,
    longitude: 127.0561,
  },
  {
    id: '2',
    name: '서울숲',
    address: '서울 성동구 뚝섬로 273',
    crowdLevel: 2,
    pins: 12,
    angles: [110, 360, 90, 270, 180],
    distance: '1.2km',
    tag: '공원 · 산책',
    latitude: 37.5444,
    longitude: 127.0374,
  },
  {
    /*
      목업 장소 시드에서 어린이대공원은 `6`번이다. `3`번은 뚝섬한강공원이라,
      예전에는 이 카드를 눌러 상세로 들어가면 **뚝섬한강공원이 열렸다.**
      아래 `demoNearbyPlaces`가 그 3번을 함께 찍기 시작하면서 id까지 겹쳤다.
    */
    id: '6',
    name: '어린이대공원',
    address: '서울 광진구 능동로 216',
    crowdLevel: 4,
    pins: 5,
    angles: [90, 230, 160, 300],
    distance: '2.8km',
    tag: '공원 · 피크닉',
    latitude: 37.5497,
    longitude: 127.0817,
  },
];

/**
 * 위 세 곳과 같은 자리를 가리키는 목업 시드. 같은 장소를 두 번 찍지 않으려고 걸러 낸다.
 *
 * `1` 성수 연무장길 · `2` 서울숲(시드 이름은 "서울숲 산책로") · `6` 어린이대공원.
 */
const ANCHOR_SEED_IDS = new Set([1, 2, 6]);

/**
 * 지도에 함께 찍는 주변 장소들. **목업 모드에서만 얹는다**(홈 화면이 판단한다).
 *
 * 위 세 곳만으로는 지도가 비어 보여 시연할 때 "핀이 안 나온다"로 읽힌다. 와이어프레임처럼
 * 여러 마커가 흩어져 있어야 필터를 바꿀 때 색과 개수가 달라지는 것을 보여줄 수 있다.
 *
 * **직접 적지 않고 장소 목업 시드에서 가져온다.** 그 표가 장소 상세도 함께 만들기 때문에,
 * 여기서 좌표와 이름을 따로 적으면 같은 `placeId`인데 지도와 상세가 어긋난다(그 파일이 경고하는
 * 바로 그 상황이다). 시드에서 가져오면 **마커를 누르면 그 장소의 상세가 그대로 열린다.**
 *
 * 핀이 없는 장소는 뺀다. 지도에 찍혀도 열면 "올라온 영상핀이 없어요"만 나온다.
 */
export const demoNearbyPlaces: MockPlace[] = mockPlaceSeeds
  .filter((seed) => !ANCHOR_SEED_IDS.has(seed.placeId) && seed.pins.length > 0)
  .map((seed) => {
    const average = averageCrowdLevelOf(seed);

    return {
      id: String(seed.placeId),
      name: seed.name,
      address: seed.address,
      // 요일 평균은 소수(2.4 등)라 가장 가까운 단계로 맞춘다. 혼잡도 필터가 이 값을 본다.
      crowdLevel: average === null ? 2 : getCrowdLevelByValue(average).level,
      pins: seed.activePinCount,
      angles: seed.pins.map((pin) => pin.viewAngle),
      latitude: seed.latitude,
      longitude: seed.longitude,
    };
  });

/** 혼잡도 라벨/색은 단계 값에서 파생한다 (표시 문자열을 데이터에 중복 저장하지 않는다). */
export function getPlaceCrowd(place: MockPlace) {
  return getCrowdLevelByValue(place.crowdLevel);
}

export const videoPins = [
  {
    id: '1',
    place: '성수 연무장길',
    detail: '메인 거리 입구',
    time: '3분 전',
    status: '보통',
    color: colors.normal,
    memo: '팝업 대기는 10분 정도예요',
    author: '성수산책러',
    view: '84.5°',
    tags: ['팝업', '데이트'],
  },
  {
    id: '2',
    place: '성수 연무장길',
    detail: '카페거리 앞',
    time: '8분 전',
    status: '약간 여유',
    color: colors.easy,
    memo: '골목 안쪽은 한산해요',
    author: '오늘의기록',
    view: '91°',
    tags: ['카페'],
  },
];

export const crowd = [35, 42, 49, 62, 78, 91, 66];

export const creditRows = [
  { title: '영상핀 평가 참여', time: '오늘 오후 2:14', amount: '+1', type: '적립' },
  { title: '성수 연무장길 영상 열람', time: '오늘 오후 1:52', amount: '-3', type: '사용' },
  { title: '채팅 요청 수락', time: '어제 오후 7:03', amount: '+5', type: '적립' },
];
