import { MOCK_LATENCY_MS, delay } from './pin';
import type { PinDraftPlace } from '@/types/pinCreate';

/**
 * 장소 검색 고정 데이터.
 *
 * 백엔드에 `GET /api/v1/places/search`가 붙기 전까지 화면을 돌린다.
 * 실제 API도 키워드와 현재 좌표를 받아 반경 안의 장소만 준다.
 *
 * 화면에서 확인하는 법: 내 위치 칸에 "바나" 또는 "카페"를 입력한다.
 */
const places: PinDraftPlace[] = [
  { placeId: 11, name: '바나프레소 역삼1점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { placeId: 12, name: '바나프레소 역삼점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { placeId: 13, name: '바나프레소 역삼6점', address: '서울 광진구 동일로 60길 47 1층 (군자동)' },
  { placeId: 14, name: '스타벅스 군자역점', address: '서울 광진구 능동로 234 (군자동)' },
  { placeId: 15, name: '카페 그리다', address: '서울 광진구 동일로 58길 12 (군자동)' },
  { placeId: 16, name: '메가커피 세종대점', address: '서울 광진구 능동로 209 (화양동)' },
];

/**
 * 검색 목업.
 *
 * 좌표는 실제 API와 시그니처를 맞추기 위해 받기만 하고 걸러내지는 않는다.
 * 서버가 붙으면 반경 판정은 서버가 한다.
 */
export async function searchMockPlaces(keyword: string): Promise<PinDraftPlace[]> {
  await delay(MOCK_LATENCY_MS);

  const query = keyword.trim();
  if (!query) return [];

  return places.filter((place) => place.name.includes(query));
}
