import { useEffect } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { VideoView } from 'expo-video';
import { useIllustration } from '../illustrations';
import type { IllustrationKey } from '../illustrations';

/**
 * 전체화면 버튼을 내보내지 않는다. 컨트롤을 모두 끈 화면이라 들어갈 수단이 없다.
 *
 * 매 렌더마다 새 객체를 만들면 네이티브 쪽이 바뀐 것으로 보고 다시 설정하므로 상수로 둔다.
 */
const NO_FULLSCREEN = { enable: false } as const;

export interface IllustrationVideoProps {
  /** 화면에서 미리 받아 둔 영상 중 무엇을 그릴지(`IllustrationProvider`). */
  name: IllustrationKey;
  style?: StyleProp<ViewStyle>;
  /**
   * 기본값 `play` — 마운트할 때 처음부터 한 번 재생한다.
   *
   * `end`는 재생하지 않고 마지막 모습만 세운다. 이미 끝난 일을 보여줄 때 쓴다.
   */
  mode?: 'play' | 'end';
  /**
   * 기본값 `cover`.
   *
   * 3D 영상은 대상 주변에 빈 여백을 크게 두고 렌더된 것이 많다. `contain`으로 넣으면
   * 그 여백까지 박스에 맞춰져 대상이 실제보다 작아지므로 여백을 잘라내는 쪽을 기본으로 둔다.
   */
  contentFit?: 'contain' | 'cover';
}

/**
 * 3D 일러스트 자리에 쓰는 장식용 영상.
 *
 * 소리 없이 한 번만 재생하고 마지막 프레임에 멈춘다. 반복하면 시선을 계속 끌어
 * 정작 눌러야 하는 버튼에서 주의를 빼앗는다.
 *
 * 플레이어는 화면이 미리 만들어 둔 것을 그대로 쓴다(`useIllustration`). 그래서 마운트하는
 * 순간 이미 준비돼 있고, 빈 자리가 보였다가 뒤늦게 그림이 채워지는 일이 없다. 대신 같은
 * 플레이어를 계속 쓰므로 처음부터 보이려면 여기서 되감아야 한다.
 */
export function IllustrationVideo({
  name,
  style,
  mode = 'play',
  contentFit = 'cover',
}: IllustrationVideoProps) {
  const { player, ready } = useIllustration(name);

  useEffect(() => {
    if (!ready) return;

    if (mode === 'play') {
      player.currentTime = 0;
      player.play();
      return;
    }

    /*
      마지막 모습으로 세운다. 정확히 끝으로 보내면 재생이 끝난 상태로 취급돼 빈 화면이
      나올 수 있어 조금 앞에 세운다.
    */
    player.pause();
    if (player.duration > 0) player.currentTime = Math.max(0, player.duration - 0.05);
  }, [mode, player, ready]);

  /*
    다 받기 전에는 자리만 잡아 둔다.

    덜 받은 영상을 걸면 흰 사각형이 먼저 보였다가 그림이 나중에 채워진다. 배경만 깔린 빈 자리로
    기다리다가 준비된 뒤에 한 번에 나타나는 편이 덜 어수선하다. 시트는 아예 준비된 뒤에
    열리므로(`useIllustrationCue`) 이 자리가 보이는 경우는 평가 보상처럼 화면 안에 섞인
    장식뿐이다.
  */
  if (!ready) return <View style={style} />;

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      fullscreenOptions={NO_FULLSCREEN}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}
