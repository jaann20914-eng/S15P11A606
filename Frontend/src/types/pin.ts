import type { CrowdLevelKey } from '@/constants/crowdLevels';

export type PinStatus = 'UPLOADING' | 'PROCESSING' | 'ACTIVE' | 'EXPIRED' | 'HIDDEN' | 'FAILED';

export type VideoPin = {
  id: string;
  placeId: string;
  crowdLevel: CrowdLevelKey;
  capturedAt: string;
  expiresAt: string;
  status: PinStatus;
};
