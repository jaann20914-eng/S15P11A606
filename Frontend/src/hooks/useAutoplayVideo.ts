import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import type { VideoPlayer, VideoSource } from 'expo-video';

/** 읽기 실패 뒤 같은 소스를 다시 싣기까지 기다리는 시간(ms)과 횟수 상한. */
const VIDEO_RELOAD_DELAY_MS = 2000;
const VIDEO_RELOAD_MAX_ATTEMPTS = 5;

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
  /*
    플레이어는 **한 번만** 만들고 소스는 갈아 끼운다.

    `useVideoPlayer(source)`에 소스를 그대로 주면, 소스가 바뀔 때 플레이어를 새로 만들고 옛것을
    해제한다. 그런데 화면의 `VideoView`는 그 프레임에 아직 옛 플레이어를 참조하고 있어
    "Cannot use shared object that was already released"가 났다 — 수정 완료 후 상세로 돌아오면
    재조회가 **새 서명 URL**을 내려 소스가 반드시 바뀌므로 그때마다 터졌다(2026-08-05).
  */
  const player = useVideoPlayer(null, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });

  /*
    서명을 뗀 주소. 같은 영상이면 다시 싣지 않기 위한 비교 키다.

    Presigned URL은 조회할 때마다 서명이 달라, URL 전체로 비교하면 재조회마다 같은 영상을
    처음부터 다시 받는다 — 화면이 회색 로딩으로 돌아가 두 번 뜨는 것처럼 보였다.
    물음표 앞 경로가 곧 객체 키라 그것만 보면 같은 영상인지 알 수 있다.
  */
  const sourceKey =
    typeof source === 'object' && source !== null && 'uri' in source && source.uri
      ? source.uri.split('?')[0]
      : typeof source === 'string'
        ? source.split('?')[0]
        : JSON.stringify(source);

  const sourceRef = useRef(source);
  sourceRef.current = source;

  /** 같은 소스를 다시 실어 본 횟수. 소스가 바뀌면 처음부터 다시 센다. */
  const reloadAttemptsRef = useRef(0);

  useEffect(() => {
    reloadAttemptsRef.current = 0;
    replaceQuietly(player, sourceRef.current);
  }, [player, sourceKey]);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') player.play();

      /*
        읽기에 실패하면 잠시 뒤 같은 소스를 다시 싣는다.

        방금 만들어진 영상(AI 블러 직후)은 주소는 발급됐는데 스토리지에서 아직 읽히지 않는
        순간이 있다. 그때 플레이어는 error에 멈추고 스스로 되살아나지 않아, 등록 직후 상세가
        회색 로딩인 채 남았다 — 다른 화면에 갔다 와서 플레이어가 새로 만들어져야 떴다
        (2026-08-05). 몇 번만 다시 시도하면 그 사이 읽을 수 있게 된다.
      */
      if (status === 'error' && reloadAttemptsRef.current < VIDEO_RELOAD_MAX_ATTEMPTS) {
        reloadAttemptsRef.current += 1;

        retryTimer = setTimeout(() => {
          replaceQuietly(player, sourceRef.current);
        }, VIDEO_RELOAD_DELAY_MS);
      }
    });

    // 구독보다 준비가 먼저 끝났을 수 있다.
    player.play();

    return () => {
      subscription.remove();
      if (retryTimer !== null) clearTimeout(retryTimer);

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

/**
 * 소스를 갈아 끼운다. 이미 정리된 플레이어는 그냥 넘긴다.
 *
 * 화면이 내려가는 프레임에 효과 정리와 플레이어 해제가 겹치면 해제된 것에 손댈 수 있다.
 * 그때는 어차피 보일 화면이 없으므로 할 일이 없다.
 */
function replaceQuietly(player: VideoPlayer, source: VideoSource): void {
  try {
    void player.replaceAsync(source);
  } catch {
    // 이미 정리된 플레이어다.
  }
}
