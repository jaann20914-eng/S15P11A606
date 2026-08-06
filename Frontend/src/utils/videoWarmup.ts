import { Asset } from 'expo-asset';
import type { VideoSource } from 'expo-video';
import { createDevLogger } from './devLog';

const log = createDevLogger('video-warmup');

/**
 * 앱이 번들에 담아 두고 쓰는 장식 영상 전부.
 *
 * 여기 없는 영상은 데워지지 않는다. 새 영상을 쓰기 시작하면 이 목록에도 넣는다.
 */
const VIDEO_MODULES: number[] = [
  require('../../assets/videos/credit-coin-3d.mp4'),
  require('../../assets/videos/chat-request-3d.mp4'),
  require('../../assets/videos/credit-leaf-3d.mp4'),
  require('../../assets/videos/chat-warning-3d.mp4'),
  require('../../assets/videos/publishing-backdrop.mp4'),
  require('../../assets/videos/video-pin-crowd.mp4'),
];

/** 데워서 얻은 기기 안 파일 경로. 못 데운 것은 없는 채로 남는다. */
const localUriByModule = new Map<number, string>();

let started = false;

/**
 * 장식 영상을 기기 저장소로 미리 받아 둔다.
 *
 * 개발 중에는 `require`한 영상이 번들에 없고 **Metro 서버에서 재생 때마다 내려받는다.**
 * 그래서 시트를 열 때마다 몇 초씩 빈 자리가 보였다. 시작 화면이 도는 동안 전부 받아 두면
 * 그 뒤로는 기기 안 파일이라 바로 뜬다.
 *
 * 릴리즈에서는 파일이 APK 안에 있어 받을 것이 없고, 이 호출은 경로만 정리하고 끝난다.
 * 실패해도 화면은 원래대로 동작한다 — 데워진 것이 없으면 예전 경로(그때그때 받기)로 간다.
 */
export function warmUpVideos(): void {
  if (started) return;
  started = true;

  VIDEO_MODULES.forEach((module) => {
    const asset = Asset.fromModule(module);

    asset
      .downloadAsync()
      .then(() => {
        if (asset.localUri) localUriByModule.set(module, asset.localUri);
      })
      .catch((cause: unknown) => {
        log('데우기 실패', { 이름: asset.name, 이유: String(cause) });
      });
  });
}

/**
 * 데워진 영상이 있으면 그 파일을, 없으면 원래 모듈을 소스로 준다.
 *
 * 플레이어를 만드는 쪽이 이 함수를 거치면, 시작 화면에서 받아 둔 파일을 그대로 쓰게 된다.
 */
export function warmedVideoSource(module: number): VideoSource {
  const localUri = localUriByModule.get(module);

  return localUri ? { uri: localUri } : module;
}
