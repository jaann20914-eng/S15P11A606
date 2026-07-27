import { createStore } from './createStore';
import type { CrowdFilter } from '@/constants/crowdLevels';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** 지도 화면 범위. `/places` 의 bounds 쿼리(swLat,swLng,neLat,neLng)로 직렬화된다. */
export interface MapBounds {
  southWest: Coordinate;
  northEast: Coordinate;
}

/** 서울숲 일대 — 목업 기본 중심 좌표 */
const DEFAULT_CENTER: Coordinate = { latitude: 37.5445, longitude: 127.0374 };

export interface MapState {
  center: Coordinate;
  bounds: MapBounds | null;
  /** 상단 혼잡도 필터. 지도 핀 색 계열과 목록 필터링을 함께 결정한다. */
  crowdFilter: CrowdFilter;
  selectedPlaceId: string | null;
  setCenter: (center: Coordinate) => void;
  setBounds: (bounds: MapBounds | null) => void;
  setCrowdFilter: (crowdFilter: CrowdFilter) => void;
  toggleCrowdFilter: () => void;
  selectPlace: (placeId: string | null) => void;
}

export const useMapStore = createStore<MapState>((set, get) => ({
  center: DEFAULT_CENTER,
  bounds: null,
  crowdFilter: 'relaxed',
  selectedPlaceId: null,
  setCenter: (center) => set({ center }),
  setBounds: (bounds) => set({ bounds }),
  setCrowdFilter: (crowdFilter) => set({ crowdFilter }),
  toggleCrowdFilter: () => set({ crowdFilter: get().crowdFilter === 'relaxed' ? 'wagle' : 'relaxed' }),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
}));

/** bounds를 `/places` 쿼리 문자열 형식으로 변환한다. */
export function serializeBounds(bounds: MapBounds): string {
  const { southWest, northEast } = bounds;
  return [southWest.latitude, southWest.longitude, northEast.latitude, northEast.longitude].join(',');
}
