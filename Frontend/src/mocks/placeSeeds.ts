/**
 * 장소 목업의 단일 재료.
 *
 * 장소 목록(`/places`) · 장소 상세(`/places/{placeId}`) · 추천(`/recommendations/places`)이
 * 모두 이 표에서 나온다. 따로 두면 같은 `placeId`인데 이름이나 핀 수가 달라져, 추천에서 누른
 * 카드와 상세 화면의 내용이 어긋난다.
 */

/** 핀 하나를 만드는 재료. 나머지 필드는 규칙으로 채운다. */
export interface MockPinSeed {
  nickname: string;
  /** 작성자의 공개 뷰 각도. */
  viewAngle: number;
  /** 올린 지 몇 분 지났는지. 고정 시각을 박으면 "2분 전"이 시간이 지나며 틀려진다. */
  minutesAgo: number;
  memo: string;
  tags: string[];
}

export interface MockPlaceSeed {
  placeId: number;
  name: string;
  address: string;
  /** 연락처. 공원·산책로처럼 받을 곳이 없으면 null이다. */
  phone: string | null;
  latitude: number;
  longitude: number;
  /** 영업시간 문구. 확인할 수 없으면 null이다. 추천 카드가 쓴다. */
  businessHoursText: string | null;
  /** 지금 열람할 수 있는 전체 핀 수. `pins`보다 많을 수 있다(목록은 일부만 준다). */
  activePinCount: number;
  /** 활성 핀을 쓴 사람 수. 한 사람이 여러 개를 써도 하나로 센다. */
  uploaderCount: number;
  /** 상세 화면이 그리는 핀 카드. 첫 번째가 대표 업로더다. */
  pins: MockPinSeed[];
  /** 요일별 평균 혼잡 단계(월~일). 집계가 없는 요일은 null이다. */
  weeklyCrowdLevels: (number | null)[];
}

/** 대표 업로더. 추천 명세 예시를 그대로 쓴다. */
export const REPRESENTATIVE_NICKNAME = '감지카메라';

const memoPool = [
  '저희 곧 카페 나갈건데, 창가 자리 앉으실 분 있으실까요? 3시 30분까지 채팅주시면 자리 전달해드릴 수 있을 것 같습니다~ 편하게 연락주시면 감사하겠습니다.',
  '지금 대기 세 팀 정도 있어요. 회전은 빠른 편이라 10분이면 들어가실 수 있을 것 같습니다.',
  '2층은 자리가 많이 비어 있습니다. 콘센트 자리도 세 개 남아 있어요.',
  '야외 테이블 쪽은 바람이 좀 붑니다. 겉옷 챙겨 오시는 걸 추천드려요.',
  '방금 단체 손님이 나가서 안쪽이 통째로 비었습니다. 지금이 제일 한산해요.',
  '입구 쪽 줄이 길어 보이는데 포장 줄이라 매장은 여유 있습니다.',
];

const tagPool = [
  ['카페', '감성', '가성비맛집'],
  ['좌석없음', '콘센트', '조용함'],
  ['산책', '야외', '한적함'],
  ['웨이팅', '디저트', '분위기'],
  ['팝업', '전시', '주말'],
];

const nicknamePool = ['도장깨기 준호', '연무장 산책러', '성수 토박이', '주말탐험가', '카페인 충전소'];

/** 각도 목록으로 핀 카드를 만든다. 첫 번째는 대표 업로더가 쓴 것으로 둔다. */
function toPins(angles: number[]): MockPinSeed[] {
  return angles.map((viewAngle, index) => ({
    nickname: index === 0 ? REPRESENTATIVE_NICKNAME : nicknamePool[index % nicknamePool.length],
    viewAngle,
    minutesAgo: 2 + index * 7,
    memo: memoPool[index % memoPool.length],
    tags: tagPool[index % tagPool.length],
  }));
}

interface SeedInput extends Omit<MockPlaceSeed, 'pins'> {
  angles: number[];
}

function toSeed({ angles, ...rest }: SeedInput): MockPlaceSeed {
  return { ...rest, pins: toPins(angles) };
}

export const mockPlaceSeeds: MockPlaceSeed[] = [
  { placeId: 1, name: '성수 연무장길', address: '서울 성동구 연무장길', phone: '02-462-1024', latitude: 37.5427, longitude: 127.0559, businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 13, uploaderCount: 9, angles: [320, 90, 270, 90, 180], weeklyCrowdLevels: [2.4, 2.2, 3.4, 2.8, 3.2, 3.7, 3.1] },
  { placeId: 2, name: '서울숲 산책로', address: '서울 성동구 뚝섬로 273', phone: '02-460-2905', latitude: 37.5444, longitude: 127.0374, businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 12, uploaderCount: 8, angles: [90, 180, 320, 270, 90], weeklyCrowdLevels: [1.8, 2.0, 2.3, 2.6, 3.1, 3.8, 3.5] },
  { placeId: 3, name: '뚝섬한강공원', address: '서울 광진구 강변북로 139', phone: null, latitude: 37.5299, longitude: 127.0668, businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 6, uploaderCount: 5, angles: [270, 90, 180, 320, 90], weeklyCrowdLevels: [1.5, 1.7, 2.1, 2.2, 2.9, 3.6, 3.4] },
  { placeId: 4, name: '성수 카페거리', address: '서울 성동구 성수이로', phone: '02-499-3080', latitude: 37.5447, longitude: 127.0561, businessHoursText: '영업중 · 오후 11:00까지', activePinCount: 9, uploaderCount: 7, angles: [180, 320, 90, 90, 270], weeklyCrowdLevels: [2.6, 2.5, 3.0, 3.1, 3.5, 3.9, 3.3] },
  { placeId: 5, name: '연무장길 팝업존', address: '서울 성동구 연무장길 24', phone: '02-461-7742', latitude: 37.5412, longitude: 127.0552, businessHoursText: '영업중 · 오후 8:00까지', activePinCount: 14, uploaderCount: 11, angles: [90, 270, 320, 180, 90], weeklyCrowdLevels: [2.9, 3.0, 3.3, 3.4, 3.6, 4.0, 3.8] },
  { placeId: 6, name: '어린이대공원', address: '서울 광진구 능동로 216', phone: '02-450-9311', latitude: 37.5487, longitude: 127.0819, businessHoursText: '운영중 · 오후 10:00까지', activePinCount: 5, uploaderCount: 4, angles: [320, 180, 90, 270, 90], weeklyCrowdLevels: [1.4, 1.6, 1.9, 2.0, 2.4, 3.5, 3.3] },
  { placeId: 7, name: '건대 커먼그라운드', address: '서울 광진구 아차산로 200', phone: '02-467-2747', latitude: 37.5410, longitude: 127.0687, businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 11, uploaderCount: 6, angles: [90, 90, 180, 320, 270], weeklyCrowdLevels: [2.7, 2.8, 3.1, 3.2, 3.7, 3.9, 3.6] },
  { placeId: 8, name: '송정제방길', address: '서울 성동구 송정동 73-448', phone: null, latitude: 37.5486, longitude: 127.0714, businessHoursText: '운영중 · 24시간 이용 가능', activePinCount: 3, uploaderCount: 3, angles: [270, 320, 90], weeklyCrowdLevels: [1.2, 1.3, 1.6, 1.5, 2.0, 2.6, 2.4] },
  { placeId: 9, name: '성수 수제화거리', address: '서울 성동구 연무장7길', phone: '02-464-1114', latitude: 37.5397, longitude: 127.0570, businessHoursText: '영업중 · 오후 9:00까지', activePinCount: 7, uploaderCount: 6, angles: [180, 90, 270, 90, 320], weeklyCrowdLevels: [2.1, 2.3, 2.5, 2.7, 3.0, 3.4, 2.9] },
  // 요일 집계가 아직 없는 장소. 통계 빈칸을 확인할 수 있게 둔다.
  { placeId: 10, name: '서울숲 북쪽 산책로', address: '서울 성동구 서울숲2길', phone: null, latitude: 37.5471, longitude: 127.0413, businessHoursText: null, activePinCount: 10, uploaderCount: 7, angles: [90, 320, 90, 270, 180], weeklyCrowdLevels: [null, null, 2.2, 2.4, null, 3.2, 3.0] },
  // 감지카메라만 올린 장소. 추천 카드의 빈 상태를 확인할 수 있게 둔다.
  { placeId: 11, name: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)', phone: '010-1111-1111', latitude: 37.5556, longitude: 127.0791, businessHoursText: '영업중 · 오후 10:00까지', activePinCount: 1, uploaderCount: 1, angles: [92], weeklyCrowdLevels: [2.4, 2.2, 3.4, 2.8, 3.0, 3.2, 2.6] },
].map(toSeed);

/** `placeId`로 하나 찾는다. 없으면 null. */
export function findMockPlaceSeed(placeId: number): MockPlaceSeed | null {
  return mockPlaceSeeds.find((seed) => seed.placeId === placeId) ?? null;
}
