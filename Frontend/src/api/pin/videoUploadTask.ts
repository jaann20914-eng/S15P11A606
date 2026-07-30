import type { UploadTask } from 'expo-file-system/legacy';
import { usesMockApi } from '../config';
import { VIDEO_CONTENT_TYPE } from '@/types/pinCreate';
import type { VideoUploadTicket } from '@/types/pinCreate';

/**
 * `expo-file-system`은 네이티브 모듈이다. 최상위에서 import하면 웹에서 앱 전체가 뜨지 않는다.
 * 목업 모드에서는 쓰지도 않으므로 실제로 올릴 때만 불러온다.
 */
function loadFileSystem() {
  return require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
}

/** 업로드 진행률(0~1)을 알린다. */
export type UploadProgressListener = (ratio: number) => void;

export interface StartedUpload {
  /** 업로드가 끝나면 resolve된다. 2xx가 아니면 거부한다. */
  completed: Promise<void>;
  /** 진행 중인 업로드를 중단한다. */
  cancel: () => void;
}

/** 촬영 파일의 크기(바이트). 발급 요청에 실어 서버가 크기 정책을 서명에 넣을 수 있게 한다. */
export async function readVideoSize(fileUri: string): Promise<number> {
  if (usesMockApi) return 0;

  const info = await loadFileSystem().getInfoAsync(fileUri);
  return info.exists ? info.size : 0;
}

/**
 * 촬영 영상을 Presigned POST로 외부 스토리지에 올린다.
 *
 * 서명이 URL이 아니라 폼 필드에 있으므로 `fields`를 그대로 실은 `multipart/form-data`
 * `POST`로 보낸다. 필드 내용은 해석하지 않고 서버가 준 값을 그대로 넘긴다.
 *
 * 인증 헤더는 붙이지 않는다. 붙이면 S3가 서명 검증에서 거부한다. 그래서 공용 `httpClient`를
 * 쓰지 않는다.
 *
 * 성공은 2xx로 판정한다. Presigned POST는 기본이 `204`이고 서버가 `success_action_status`를
 * 넣었으면 `201`이라 특정 코드로 좁히지 않는다.
 */
export function startVideoUpload(
  ticket: Pick<VideoUploadTicket, 'uploadUrl' | 'fields'>,
  fileUri: string,
  onProgress: UploadProgressListener,
): StartedUpload {
  // 목업에서는 실제로 올릴 곳이 없어 진행률만 흉내낸다.
  if (usesMockApi) return startFakeUpload(onProgress);

  const { createUploadTask, FileSystemUploadType } = loadFileSystem();

  const task: UploadTask = createUploadTask(
    ticket.uploadUrl,
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      // S3는 파일 파트 이름이 `file`이어야 한다.
      fieldName: 'file',
      mimeType: VIDEO_CONTENT_TYPE,
      parameters: ticket.fields,
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress(totalBytesSent / totalBytesExpectedToSend);
    },
  );

  const completed = task.uploadAsync().then((result) => {
    // 취소하면 결과가 없다. 그 경우는 호출부가 취소로 알고 있으므로 조용히 끝낸다.
    if (!result) return;

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`영상을 올리지 못했어요 (${result.status})`);
    }

    onProgress(1);
  });

  return { completed, cancel: () => void task.cancelAsync() };
}

/** 목업용 진행률. 실제 네트워크 없이 화면 흐름만 확인한다. */
function startFakeUpload(onProgress: UploadProgressListener): StartedUpload {
  let cancelled = false;

  const completed = new Promise<void>((resolve) => {
    let sent = 0;

    const tick = setInterval(() => {
      if (cancelled) {
        clearInterval(tick);
        resolve();
        return;
      }

      sent += 0.2;
      onProgress(Math.min(sent, 1));

      if (sent >= 1) {
        clearInterval(tick);
        resolve();
      }
    }, 200);
  });

  return {
    completed,
    cancel: () => {
      cancelled = true;
    },
  };
}
