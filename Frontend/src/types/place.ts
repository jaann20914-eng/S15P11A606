// 백엔드 /api/v1/places 응답에 맞춘 도메인 타입. 연동 전이라 아직 참조하는 화면이 없다.
import type { PlaceCategory } from '@/constants/categories';

export type Place = {
  /** 서버 식별자. DB가 BIGINT라 숫자로 다룬다. */
  id: number;
  name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
};
