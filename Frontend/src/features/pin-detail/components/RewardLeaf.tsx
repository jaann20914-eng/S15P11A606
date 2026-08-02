import { useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';

const LEAF_VIDEO = require('../../../../assets/videos/credit-leaf-3d.mp4');

/** 컨트롤을 모두 끈 장식이라 전체화면으로 들어갈 수단이 없다. 매 렌더마다 새로 만들지 않는다. */
const NO_FULLSCREEN = { enable: false } as const;

export interface RewardLeafProps {
  /**
   * 방금 크레딧을 받았는지.
   *
   * 참이면 잎이 떨어지는 장면을 한 번 재생한다. 거짓이면 이미 떨어진 마지막 모습만 보여준다.
   */
  animate: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 평가 보상 자리의 나뭇잎.
 *
 * 크레딧이 들어오는 순간에만 잎이 떨어진다. 이미 받은 것을 다시 볼 때마다 떨어지면, 아무 일도
 * 일어나지 않았는데 무언가 일어난 것처럼 읽히고 화면에 들어올 때마다 시선을 뺏긴다. 그래서
 * 그 뒤로는 바닥에 떨어진 채로 멈춰 있는다 — 같은 그림이지만 "이미 끝난 일"로 보인다.
 *
 * 재생 여부는 마운트 시점에 정해진다. `animate`가 도중에 바뀌어도 다시 재생하지 않으므로,
 * 처음부터 보여주려면 호출부에서 다시 마운트해야 한다.
 */
export function RewardLeaf({ animate, style }: RewardLeafProps) {
  return animate ? <FallingLeaf style={style} /> : <SettledLeaf style={style} />;
}

/** 한 번 떨어지고 그대로 멈춘다(`loop: false`). */
function FallingLeaf({ style }: { style?: StyleProp<ViewStyle> }) {
  const player = useAutoplayVideo(LEAF_VIDEO, { loop: false, muted: true });

  return <LeafView player={player} style={style} />;
}

/**
 * 재생하지 않고 마지막 프레임만 세운다.
 *
 * 준비되기 전에는 `duration`이 0이라 옮길 수 없으므로 `statusChange`를 기다린다.
 * 정확히 끝으로 보내면 재생이 끝난 상태로 취급돼 빈 화면이 나올 수 있어 조금 앞에 세운다.
 */
function SettledLeaf({ style }: { style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(LEAF_VIDEO, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  useEffect(() => {
    const seekToEnd = () => {
      if (player.duration > 0) player.currentTime = Math.max(0, player.duration - 0.05);
    };

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') seekToEnd();
    });

    // 구독보다 준비가 먼저 끝났을 수 있다.
    seekToEnd();

    return () => subscription.remove();
  }, [player]);

  return <LeafView player={player} style={style} />;
}

function LeafView({ player, style }: { player: ReturnType<typeof useVideoPlayer>; style?: StyleProp<ViewStyle> }) {
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={NO_FULLSCREEN}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}
