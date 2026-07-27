import type { PlaceCategory } from '@/constants/categories';

export type Place = {
  id: string;
  name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
};
