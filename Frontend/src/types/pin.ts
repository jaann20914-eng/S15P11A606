// 백엔드 영상핀 응답에 맞춘 도메인 타입. 연동 전이라 아직 참조하는 화면이 없다.
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
