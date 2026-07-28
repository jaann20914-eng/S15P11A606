import { colors } from '@/constants/theme';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { CrowdLevelValue } from '@/constants/crowdLevels';

type MockPlace = {
  id: string;
  name: string;
  address: string;
  /** 최근 1시간 유효 핀의 평균 혼잡 단계 (1~4) */
  crowdLevel: CrowdLevelValue;
  pins: number;
  distance: string;
  tag: string;
  /** 지도 핀 좌표 (WGS84). 실제 연동 시 `/places` 응답의 좌표로 대체한다. */
  latitude: number;
  longitude: number;
};

export const places: MockPlace[] = [
  { id: '1', name: '성수 연무장길', address: '서울 성동구 연무장길', crowdLevel: 1, pins: 8, distance: '620m', tag: '팝업 · 카페', latitude: 37.5427, longitude: 127.0561 },
  { id: '2', name: '서울숲', address: '서울 성동구 뚝섬로 273', crowdLevel: 2, pins: 12, distance: '1.2km', tag: '공원 · 산책', latitude: 37.5444, longitude: 127.0374 },
  { id: '3', name: '어린이대공원', address: '서울 광진구 능동로 216', crowdLevel: 4, pins: 5, distance: '2.8km', tag: '공원 · 피크닉', latitude: 37.5497, longitude: 127.0817 },
];

/** 혼잡도 라벨/색은 단계 값에서 파생한다 (표시 문자열을 데이터에 중복 저장하지 않는다). */
export function getPlaceCrowd(place: MockPlace) {
  return getCrowdLevelByValue(place.crowdLevel);
}

export const videoPins = [
  { id: '1', place: '성수 연무장길', detail: '메인 거리 입구', time: '3분 전', status: '보통', color: colors.normal, memo: '팝업 대기는 10분 정도예요', author: '성수산책러', view: '84.5°', tags: ['팝업', '데이트'] },
  { id: '2', place: '성수 연무장길', detail: '카페거리 앞', time: '8분 전', status: '약간 여유', color: colors.easy, memo: '골목 안쪽은 한산해요', author: '오늘의기록', view: '91°', tags: ['카페'] },
];

export const crowd = [35, 42, 49, 62, 78, 91, 66];

export const creditRows = [
  { title: '영상핀 평가 참여', time: '오늘 오후 2:14', amount: '+1', type: '적립' },
  { title: '성수 연무장길 영상 열람', time: '오늘 오후 1:52', amount: '-3', type: '사용' },
  { title: '채팅 요청 수락', time: '어제 오후 7:03', amount: '+5', type: '적립' },
];
