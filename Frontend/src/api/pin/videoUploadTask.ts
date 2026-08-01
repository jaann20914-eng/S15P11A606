import type { UploadTask } from 'expo-file-system/legacy';
import { usesMock } from '../config';
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

/** 개발 중 어느 단계에서 막혔는지 터미널에서 따라갈 수 있게 한다. */
function logUpload(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[pin-upload] ${step}`, detail ?? '');
}

/**
 * 촬영 파일의 크기(바이트).
 *
 * 발급 요청에 싣는다. 서버는 이 값이 **양수가 아니면 400(`INVALID_UPLOAD_REQUEST`)** 으로
 * 막으므로, 못 읽었으면 그대로 보내지 말고 여기서 드러나야 한다.
 */
export async function readVideoSize(fileUri: string): Promise<number> {
  if (usesMock('pin/videoUploadTask')) return 1;

  const info = await loadFileSystem().getInfoAsync(fileUri);
  const size = info.exists ? info.size : 0;

  logUpload('파일 크기', { size, exists: info.exists, uri: fileUri.slice(0, 40) });
  return typeof size === 'number' && size > 0 ? size : 0;
}

/**
 * 촬영 영상을 Presigned PUT으로 외부 스토리지에 올린다.
 *
 * 서명이 URL 자체에 들어 있어 폼 필드가 없다. 파일 본문만 그대로 실어 `PUT` 한 번을 보낸다.
 *
 * **`Content-Type`은 발급 요청에 적은 값과 같아야 한다.** 다르면 S3가 서명 검증에서 거부한다
 * (서명에 이 헤더가 포함된다).
 *
 * 인증 헤더는 붙이지 않는다. 붙여도 같은 이유로 거부된다. 그래서 공용 `httpClient`를 쓰지 않는다.
 *
 * 성공은 2xx로 판정한다. Presigned PUT은 보통 `200`이다.
 */
export function startVideoUpload(
  ticket: Pick<VideoUploadTicket, 'uploadUrl'>,
  fileUri: string,
  onProgress: UploadProgressListener,
): StartedUpload {
  // 목업에서는 실제로 올릴 곳이 없어 진행률만 흉내낸다.
  if (usesMock('pin/videoUploadTask')) return startFakeUpload(onProgress);

  const { createUploadTask, FileSystemUploadType } = loadFileSystem();

  const task: UploadTask = createUploadTask(
    ticket.uploadUrl,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': VIDEO_CONTENT_TYPE },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress(totalBytesSent / totalBytesExpectedToSend);
    },
  );

  logUpload('업로드 시작', { url: ticket.uploadUrl.split('?')[0], contentType: VIDEO_CONTENT_TYPE });

  const completed = task.uploadAsync().then((result) => {
    // 취소하면 결과가 없다. 그 경우는 호출부가 취소로 알고 있으므로 조용히 끝낸다.
    if (!result) return;

    if (result.status < 200 || result.status >= 300) {
      /*
        S3가 왜 거절했는지는 본문에 XML로 온다(`<Code>SignatureDoesNotMatch</Code>` 등).
        상태 코드만으로는 헤더 문제인지 URL 문제인지 알 수 없어 그대로 남긴다.
      */
      logUpload('업로드 실패', { status: result.status, body: result.body?.slice(0, 400) });
      throw new Error(`영상을 올리지 못했어요 (${result.status})`);
    }

    logUpload('업로드 완료', { status: result.status });
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
