import type { CrowdLevelKey } from '@/constants/crowdLevels';

/**
 * 핀 처리 상태.
 *
 * 2026-07-27 기준 DB(`PENDING/PROCESSING/COMPLETED/FAILED`)와
 * API 명세(`PROCESSING/ACTIVE/RESHOOT`)의 값이 서로 달라 확정되지 않았다.
 * 백엔드 답변 후 정리한다.
 */
export type PinStatus = 'UPLOADING' | 'PROCESSING' | 'ACTIVE' | 'EXPIRED' | 'HIDDEN' | 'FAILED';

export type VideoPin = {
  /** 서버 식별자. DB가 BIGINT라 숫자로 다룬다. */
  id: number;
  placeId: number;
  crowdLevel: CrowdLevelKey;
  capturedAt: string;
  expiresAt: string;
  status: PinStatus;
};
