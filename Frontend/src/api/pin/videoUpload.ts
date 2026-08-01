import { apiRequest } from '../client';
import { usesMock } from '../config';
import { issueMockVideoUpload } from '@/mocks/pin';
import type { VideoUploadTicket } from '@/types/pinCreate';

/**
 * 원본 영상 업로드 정보 발급 — `POST /api/v1/pins/upload-url`
 *
 * 영상 파일은 이 요청에 싣지 않는다. 서버가 객체 키를 만들고 그 자리에 올릴 수 있는
 * Presigned **PUT** URL을 준다. 프론트는 그 URL로 영상을 직접 올린 뒤, 등록 요청
 * (`POST /api/v1/pins`)에 `originalVideoKey`만 넘긴다.
 *
 * `contentType`은 MVP에서 `video/mp4`만 허용한다. `fileSize`는 바이트 단위 양수이며 서버가
 * 정한 최대 크기를 넘을 수 없다. 두 값은 URL을 발급하기 위한 것이고, 실제 객체 검증은 서버가
 * 핀 등록 시점에 다시 한다.
 *
 * 발급받은 URL은 한 번만 쓴다. 같은 키로 두 번 등록하면 서버가 409로 거절한다.
 *
 * 오류 코드: `INVALID_UPLOAD_REQUEST` `UNAUTHORIZED` `UPLOAD_URL_ISSUE_FAILED`.
 */
function requestVideoUploadTicket(contentType: string, fileSize: number): Promise<VideoUploadTicket> {
  return apiRequest<VideoUploadTicket>({
    method: 'POST',
    url: '/api/v1/pins/upload-url',
    data: { contentType, fileSize },
  });
}

export async function issueVideoUploadTicket(
  contentType: string,
  fileSize: number,
): Promise<VideoUploadTicket> {
  if (usesMock('pin/videoUpload')) return issueMockVideoUpload(contentType, fileSize);
  return requestVideoUploadTicket(contentType, fileSize);
}
