import { apiRequest } from '../client';
import { usesMock } from '../config';
import { issueMockVideoUpload } from '@/mocks/pin';
import type { VideoUploadTicket } from '@/types/pinCreate';

/**
 * 원본 영상 업로드용 Presigned URL 발급.
 *
 * 이 파일이 발급 API 계약을 담는 유일한 곳이다. 명세가 확정되면 여기만 고치면 되고
 * 업로드·등록 흐름은 그대로 쓴다.
 *
 * 아직 확정되지 않아 가정한 것:
 * - 경로 `POST /api/v1/pins/videos/upload-url`
 * - 응답 `{ uploadUrl, originalVideoKey }`
 * - 요청에 `contentType`·`contentLength`를 실어 서버가 서명에 포함할 수 있게 한다
 *
 * 오류 코드: `UNAUTHORIZED` `INVALID_REQUEST` `DAILY_PIN_LIMIT_EXCEEDED`(추정).
 */
function requestVideoUploadTicket(contentType: string, contentLength: number): Promise<VideoUploadTicket> {
  return apiRequest<VideoUploadTicket>({
    method: 'POST',
    url: '/api/v1/pins/videos/upload-url',
    data: { contentType, contentLength },
  });
}

export async function issueVideoUploadTicket(
  contentType: string,
  contentLength: number,
): Promise<VideoUploadTicket> {
  if (usesMock('pin/videoUpload')) return issueMockVideoUpload(contentType, contentLength);
  return requestVideoUploadTicket(contentType, contentLength);
}
