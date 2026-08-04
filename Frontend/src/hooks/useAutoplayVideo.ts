import { useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import type { VideoPlayer, VideoSource } from 'expo-video';

export interface AutoplayVideoOptions {
  /** 끝까지 재생한 뒤 처음부터 다시 재생할지. */
  loop: boolean;
  /** 음소거로 시작할지. 켜고 끄는 것은 화면이 `player.muted`로 직접 바꾼다. */
  muted: boolean;
}

/**
 * 화면에 들어오면 스스로 재생되는 영상 플레이어.
 *
 * `useVideoPlayer`의 setup에서 `play()`를 불러도 재생되지 않는다. 그 시점에는 소스가 아직
 * 준비되지 않아 호출이 그대로 버려진다. 마운트 직후에 한 번 더 부르는 것도 마찬가지로
 * 이르다. 그 결과 데이터를 다 받은 뒤에도 첫 프레임에 멈춰 있어 정지 화면처럼 보인다.
 *
 * 그래서 준비 완료를 알리는 `statusChange`를 듣고 그때 재생한다. 이미 준비된 뒤에
 * 구독하는 경우를 놓치지 않도록 구독 직후에도 한 번 부른다.
 *
 * 버퍼링으로 `loading`을 거쳐 다시 `readyToPlay`가 되면 이어서 재생한다. 한 번만 재생하는
 * 영상은 `loop`가 꺼져 있어 끝난 뒤 상태가 바뀌지 않으므로 다시 시작되지 않는다.
 *
 * **그 화면이 보이는 동안만 재생한다.** 다른 화면으로 옮겨도 앞 화면은 스택에 남아 있어,
 * 멈추지 않으면 소리가 두 겹으로 들린다 — 핀 상세에서 소리를 켠 채 수정으로 들어가면 상세의
 * 영상과 수정 화면의 영상이 함께 들렸다. 돌아오면 다시 재생한다.
 */
export function useAutoplayVideo(source: VideoSource, { loop, muted }: AutoplayVideoOptions): VideoPlayer {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') player.play();
    });

    // 구독보다 준비가 먼저 끝났을 수 있다.
    player.play();

    return () => {
      subscription.remove();

      /*
        화면에서 사라질 때 재생을 멈춘다.

        플레이어가 정리되기 전까지 소리가 계속 들리는 경우가 있다 — 수정 화면에서 기존 영상을
        보다가 "다시 촬영"으로 바꾸거나 뒤로 나갔을 때 소리만 남았다. 소리를 켜고 재생하는
        화면이라(`muted: false`) 그 잔상이 그대로 들린다.
      */
      pauseQuietly(player);
    };
  }, [player]);

  /*
    화면이 보이는 동안만 재생한다.

    다른 화면으로 옮겨도 앞 화면은 스택에 남아 있어 언마운트되지 않는다. 멈추지 않으면 두
    화면의 소리가 겹친다. 돌아오면 다시 재생하고, 소리를 켜 둔 상태는 그대로 이어진다.
  */
  useFocusEffect(
    useCallback(() => {
      player.play();

      return () => pauseQuietly(player);
    }, [player]),
  );

  return player;
}

/**
 * 재생을 멈춘다. 이미 정리된 플레이어는 그냥 넘긴다.
 *
 * 정리 순서에 따라 해제된 플레이어에 손대는 경우가 있고, 그때 예외가 난다. 멈추는 것이
 * 목적이므로 못 멈췄다면 이미 멈춘 것이라 할 일이 없다.
 */
function pauseQuietly(player: VideoPlayer): void {
  try {
    player.pause();
  } catch {
    // 이미 정리된 플레이어다.
  }
}
