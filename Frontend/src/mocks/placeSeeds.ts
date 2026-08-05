/**
 * 장소 목업의 단일 재료.
 *
 * 장소 목록(`/places`) · 장소 상세(`/places/{placeId}`) · 추천(`/recommendations/places`)이
 * 모두 이 표에서 나온다. 따로 두면 같은 `placeId`인데 이름이나 핀 수가 달라져, 추천에서 누른
 * 카드와 상세 화면의 내용이 어긋난다.
 *
 * 장소의 정체(이름·주소·연락처·좌표·영업시간)만 손으로 적고, 핀과 요일 통계는 `placeId`를
 * 씨앗으로 만들어 낸다. 전부 손으로 적으면 장소마다 같은 문구·같은 각도가 반복돼 화면을
 * 확인할 때 무엇이 실제로 바뀌는 값인지 알 수 없다.
 */

/** 핀 하나를 만드는 재료. 나머지 필드는 규칙으로 채운다. */
export interface MockPinSeed {
  nickname: string;
  /** 작성자의 공개 뷰 각도. */
  viewAngle: number;
  /** 올린 지 몇 분 지났는지. 고정 시각을 박으면 "2분 전"이 시간이 지나며 틀려진다. */
  minutesAgo: number;
  /** 공개 메모. 등록 때 선택 입력이라 **없는 핀도 있다**(서버가 null을 준다). */
  memo: string | null;
  tags: string[];
  /** 장소 좌표에서 얼마나 떨어져 있는지. 지도에 핀을 흩어 놓는 데 쓴다. */
  latitudeOffset: number;
  longitudeOffset: number;
}

export interface MockPlaceSeed {
  placeId: number;
  name: string;
  address: string;
  /** 연락처. 공원·산책로처럼 받을 곳이 없으면 null이다. */
  phone: string | null;
  /**
   * 지도에 찍을 좌표. 손으로 넣은 **근사값**이다.
   *
   * 지도는 이 값을 그대로 찍으므로, 카카오 지도가 그 자리에 그려 주는 건물·상호 이름이
   * 아래 `name`과 딱 맞지는 않는다. 목업 장소 자체가 실재하지 않는 곳도 있다.
   * 실제 좌표는 서버가 `GET /api/v1/places`의 `latitude`·`longitude`로 준다.
   */
  latitude: number;
  longitude: number;
  /** 영업시간 문구. 확인할 수 없으면 null이다. 추천 카드가 쓴다. */
  businessHoursText: string | null;
  /** 지금 열람할 수 있는 전체 핀 수. 상세가 그리는 `pins`와 항상 같다. */
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

/**
 * 씨앗 하나로 같은 값을 되풀이해 주는 난수(mulberry32).
 *
 * `Math.random`을 쓰지 않는 이유는 화면을 다시 열 때마다 목업이 바뀌면 안 되기 때문이다.
 * 무엇이 바뀌었는지 눈으로 비교할 수 없고, 시연 중에 값이 달라지면 설명도 어긋난다.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nicknames = [
  '도장깨기 준호',
  '연무장 산책러',
  '성수 토박이',
  '주말탐험가',
  '카페인 충전소',
  '한강 러너',
  '퇴근길 구경꾼',
  '팝업 수집가',
  '골목 사진사',
  '점심시간 정찰병',
];

const memos = [
  '저희 곧 나갈 건데 창가 자리 앉으실 분 계실까요? 3시 30분까지 채팅 주시면 자리 전달해 드릴 수 있을 것 같아요.',
  '지금 대기 세 팀 정도 있습니다. 회전은 빠른 편이라 10분이면 들어가실 수 있을 것 같아요.',
  '2층은 자리가 많이 비어 있어요. 콘센트 자리도 세 개 남아 있습니다.',
  '야외 테이블 쪽은 바람이 좀 붑니다. 겉옷 챙겨 오시는 걸 추천드려요.',
  '방금 단체 손님이 나가서 안쪽이 통째로 비었어요. 지금이 제일 한산합니다.',
  '입구 줄이 길어 보이는데 포장 줄이라 매장은 여유 있습니다.',
  '주차장은 이미 만차예요. 골목 공영주차장 쪽으로 돌아오시는 게 빠를 것 같습니다.',
  '햇빛이 정면으로 들어와서 창가 쪽은 좀 덥습니다. 안쪽이 훨씬 시원해요.',
  '공사 소리가 계속 나서 통화나 회의는 어려울 것 같아요. 조용한 자리 찾으시면 참고하세요.',
  '아이 데리고 오시는 분들 많아서 유아 의자는 다 나갔습니다.',
  '지금 노을 지는 중인데 강 쪽 벤치가 딱 비었어요.',
  '입장 줄이 건물 밖까지 이어집니다. 30분은 잡으셔야 할 것 같아요.',
];

/**
 * 핀에 붙는 태그 어휘.
 *
 * 태그 검색 목업이 이 목록을 그대로 쓴다. 따로 두면 자동완성이 제안한 태그가 정작 어느
 * 핀에도 없어, 고르는 순간 항상 빈 결과가 된다.
 */
export const mockTagVocabulary = [
  '카페',
  '감성',
  '가성비맛집',
  '좌석없음',
  '콘센트',
  '조용함',
  '산책',
  '야외',
  '한적함',
  '웨이팅',
  '디저트',
  '분위기',
  '팝업',
  '전시',
  '주말',
  '노을',
  '주차어려움',
  '반려동물',
];

/** 목록에서 하나 고른다. */
function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

/** 겹치지 않게 여러 개 고른다. */
function pickMany<T>(items: readonly T[], count: number, random: () => number): T[] {
  const rest = [...items];
  const picked: T[] = [];
  for (let index = 0; index < count && rest.length > 0; index += 1) {
    picked.push(rest.splice(Math.floor(random() * rest.length), 1)[0]);
  }
  return picked;
}

/**
 * 핀을 흩어 놓는 반경(위경도 도 단위). 중심에서 약 ±33m다.
 *
 * **축척 20m 화면에 한 장소의 핀이 모두 담겨야 한다.** 핀을 오르내리며 지도가 따라
 * 움직이는 것을 보려면 마커들이 한눈에 들어와야 하기 때문이다. 예전 값(0.0011, ±60m)은
 * 그 축척에서 화면 폭을 꽉 채워 몇 개가 밖으로 나갔다.
 *
 * 마커 지름이 그 축척에서 10m쯤이라 이 정도면 여섯 개가 겹치지 않고 흩어진다.
 */
const PIN_SCATTER_DEGREES = 0.0006;

/**
 * 장소 하나의 핀을 만든다.
 *
 * 첫 번째는 대표 업로더(감지카메라)가 쓴 것으로 두고, 나머지는 씨앗에 따라 사람·문구·각도·
 * 시각·좌표가 모두 달라진다.
 */
function buildPins(placeId: number, count: number): MockPinSeed[] {
  const random = createRandom(placeId * 7919);
  const people = pickMany(nicknames, Math.max(count - 1, 0), random);
  const stories = pickMany(memos, count, random);

  return Array.from({ length: count }, (_, index) => ({
    nickname: index === 0 ? REPRESENTATIVE_NICKNAME : people[index - 1],
    // 90~360도, 10도 단위. 링 이미지가 그 간격으로 있다.
    viewAngle: 90 + Math.floor(random() * 28) * 10,
    // 셋째 핀마다 메모를 비운다. 서버가 null을 주는 경우를 목업에서도 만나야 화면이 그때
    // 깨지는지 시연 단계에서 알 수 있다.
    memo: index % 3 === 2 ? null : stories[index],
    tags: pickMany(mockTagVocabulary, 2 + Math.floor(random() * 2), random),
    latitudeOffset: (random() - 0.5) * PIN_SCATTER_DEGREES,
    longitudeOffset: (random() - 0.5) * PIN_SCATTER_DEGREES,
    // 최신순으로 늘어놓는다. 목록이 등록 시각 내림차순이라 뒤로 갈수록 오래된 것이 온다.
    minutesAgo: 0,
  }))
    .map((pin, index) => ({ ...pin, minutesAgo: 2 + index * (3 + Math.floor(random() * 9)) }))
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/** 요일 혼잡도의 기본 모양. 평일은 낮고 주말로 갈수록 오른다. */
const WEEKLY_BASE = [2.2, 2.3, 2.6, 2.8, 3.2, 3.7, 3.3];

/**
 * 장소 하나의 요일 통계를 만든다.
 *
 * 기본 곡선에 장소마다 다른 흔들림을 준다. 전부 같은 값이면 어느 장소를 열어도 그래프가
 * 똑같아서 그래프가 실제 데이터를 그리는지 확인할 수 없다.
 */
function buildWeeklyLevels(placeId: number, shift: number, sparse: boolean): (number | null)[] {
  const random = createRandom(placeId * 104_729);

  return WEEKLY_BASE.map((base, index) => {
    // 집계가 없는 요일을 가진 장소도 하나 둔다. 그래프가 선을 끊는지 확인할 수 있어야 한다.
    if (sparse && (index === 0 || index === 1 || index === 4)) return null;

    const value = base + shift + (random() - 0.5) * 0.8;
    return Math.round(Math.min(Math.max(value, 1), 4) * 10) / 10;
  });
}

/** 손으로 적는 부분. 나머지는 `placeId`를 씨앗으로 만든다. */
interface SeedInput {
  placeId: number;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  businessHoursText: string | null;
  /** 이 장소의 활성 핀 수. 목록 카드의 개수와 상세 카드 수가 모두 이 값에서 나온다. */
  pinCount: number;
  /** 혼잡도 기본 곡선을 위아래로 옮기는 값. 여유로운 곳은 음수. */
  crowdShift: number;
  /** 요일 집계가 군데군데 비어 있는 장소인지. */
  sparseStats?: boolean;
}

function toSeed(input: SeedInput): MockPlaceSeed {
  const pins = buildPins(input.placeId, input.pinCount);

  return {
    placeId: input.placeId,
    name: input.name,
    address: input.address,
    phone: input.phone,
    latitude: input.latitude,
    longitude: input.longitude,
    businessHoursText: input.businessHoursText,
    pins,
    activePinCount: pins.length,
    // 한 사람이 여러 개를 써도 하나로 세므로 닉네임 종류가 곧 사람 수다.
    uploaderCount: new Set(pins.map((pin) => pin.nickname)).size,
    weeklyCrowdLevels: buildWeeklyLevels(input.placeId, input.crowdShift, input.sparseStats ?? false),
  };
}

export const mockPlaceSeeds: MockPlaceSeed[] = [
  {
    placeId: 1,
    name: '성수 연무장길',
    address: '서울 성동구 연무장길',
    phone: '02-462-1024',
    latitude: 37.5427,
    longitude: 127.0559,
    businessHoursText: '영업중 · 오후 10:00까지',
    pinCount: 6,
    crowdShift: 0.3,
  },
  {
    placeId: 2,
    name: '서울숲 산책로',
    address: '서울 성동구 뚝섬로 273',
    phone: '02-460-2905',
    latitude: 37.5444,
    longitude: 127.0374,
    businessHoursText: '운영중 · 24시간 이용 가능',
    pinCount: 6,
    crowdShift: -0.2,
  },
  {
    placeId: 3,
    name: '뚝섬한강공원',
    address: '서울 광진구 강변북로 139',
    phone: null,
    latitude: 37.5295,
    longitude: 127.07,
    businessHoursText: '운영중 · 24시간 이용 가능',
    pinCount: 6,
    crowdShift: -0.5,
  },
  {
    placeId: 4,
    name: '성수 카페거리',
    address: '서울 성동구 성수이로',
    phone: '02-499-3080',
    latitude: 37.5447,
    longitude: 127.0561,
    businessHoursText: '영업중 · 오후 11:00까지',
    pinCount: 6,
    crowdShift: 0.2,
  },
  {
    placeId: 5,
    name: '연무장길 팝업존',
    address: '서울 성동구 연무장길 24',
    phone: '02-461-7742',
    latitude: 37.5412,
    longitude: 127.0552,
    businessHoursText: '영업중 · 오후 8:00까지',
    pinCount: 6,
    crowdShift: 0.5,
  },
  {
    placeId: 6,
    name: '어린이대공원',
    address: '서울 광진구 능동로 216',
    phone: '02-450-9311',
    latitude: 37.5487,
    longitude: 127.0819,
    businessHoursText: '운영중 · 오후 10:00까지',
    pinCount: 6,
    crowdShift: -0.6,
  },
  {
    placeId: 7,
    name: '건대 커먼그라운드',
    address: '서울 광진구 아차산로 200',
    phone: '02-467-2747',
    latitude: 37.541,
    longitude: 127.0665,
    businessHoursText: '영업중 · 오후 10:00까지',
    pinCount: 6,
    crowdShift: 0.4,
  },
  {
    placeId: 8,
    name: '송정제방길',
    address: '서울 성동구 송정동 73-448',
    phone: null,
    latitude: 37.5486,
    longitude: 127.0714,
    businessHoursText: '운영중 · 24시간 이용 가능',
    pinCount: 6,
    crowdShift: -0.9,
  },
  {
    placeId: 9,
    name: '성수 수제화거리',
    address: '서울 성동구 연무장7길',
    phone: '02-464-1114',
    latitude: 37.5405,
    longitude: 127.0575,
    businessHoursText: '영업중 · 오후 9:00까지',
    pinCount: 6,
    crowdShift: -0.1,
  },
  // 요일 집계가 군데군데 없는 장소. 그래프가 선을 끊는지 확인할 수 있게 둔다.
  {
    placeId: 10,
    name: '서울숲 북쪽 산책로',
    address: '서울 성동구 서울숲2길',
    phone: null,
    latitude: 37.5471,
    longitude: 127.0413,
    businessHoursText: null,
    pinCount: 6,
    crowdShift: 0,
    sparseStats: true,
  },
  // 아직 아무도 올리지 않은 장소. 빈 상태(작성 유도)를 확인할 수 있게 둔다.
  // 핀 수는 0이어야 한다 — 목록 카드는 "아직 없다"고 하는데 상세에는 핀이 있으면 어긋난다.
  {
    placeId: 11,
    name: '바나프레소 역삼점',
    address: '서울 광진구 동일로 60길 47 1층 (군자동)',
    phone: '010-1111-1111',
    latitude: 37.5556,
    longitude: 127.0791,
    businessHoursText: '영업중 · 오후 10:00까지',
    pinCount: 0,
    crowdShift: 0.1,
  },
].map(toSeed);

/**
 * 이 장소의 평균 혼잡 단계.
 *
 * 실제로는 최근 1시간 유효 핀으로 서버가 계산한다. 목업은 요일 통계의 평균으로 대신한다 —
 * 장소마다 값이 다르기만 하면 화면을 확인하는 데는 충분하다.
 */
export function averageCrowdLevelOf(seed: MockPlaceSeed): number | null {
  const values = seed.weeklyCrowdLevels.filter((level): level is number => level !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((total, level) => total + level, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/** 붐빔으로 분류하는 경계. 명세와 같이 3.0부터다. */
export const WAGLE_FROM_LEVEL = 3;

/** `placeId`로 하나 찾는다. 없으면 null. */
export function findMockPlaceSeed(placeId: number): MockPlaceSeed | null {
  return mockPlaceSeeds.find((seed) => seed.placeId === placeId) ?? null;
}
