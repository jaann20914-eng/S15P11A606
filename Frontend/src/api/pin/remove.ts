import { apiRequest } from '../client';
import { usesMockApi } from '../config';
import { deleteMockPin } from '@/mocks/pin';

/**
 * 내가 쓴 게시글 삭제 — `DELETE /api/v1/pins/{pinId}`
 *
 * 작성자가 아니면 서버가 403을 준다. 2026-07-28 기준 명세가 아직 공유되지 않아
 * 경로는 상세 조회와 같은 리소스에 메서드만 바꾼 관례를 따랐다.
 */
async function requestDeletePin(pinId: number): Promise<void> {
  await apiRequest<null>({ method: 'DELETE', url: `/api/v1/pins/${pinId}` });
}

export function deletePin(pinId: number): Promise<void> {
  return usesMockApi ? deleteMockPin(pinId) : requestDeletePin(pinId);
}
