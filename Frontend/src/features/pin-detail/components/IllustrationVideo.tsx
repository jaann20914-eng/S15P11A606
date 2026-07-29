import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { VideoSource } from 'expo-video';

export interface IllustrationVideoProps {
  source: VideoSource;
  style?: StyleProp<ViewStyle>;
  /**
   * 기본값 `cover`.
   *
   * 3D 영상은 대상 주변에 빈 여백을 크게 두고 렌더된 것이 많다. `contain`으로 넣으면
   * 그 여백까지 박스에 맞춰져 대상이 실제보다 작아지므로 여백을 잘라내는 쪽을 기본으로 둔다.
   */
  contentFit?: 'contain' | 'cover';
}

/**
 * 모달의 3D 일러스트 자리에 쓰는 장식용 영상.
 *
 * 소리 없이 한 번만 재생하고 마지막 프레임에 멈춘다. 반복하면 시선을 계속 끌어
 * 정작 눌러야 하는 버튼에서 주의를 빼앗는다.
 *
 * 모달을 다시 열면 처음부터 재생돼야 하므로 호출부에서 열릴 때만 마운트한다.
 * 조작할 것이 없어 컨트롤은 모두 끈다. 크기는 호출부가 `style`로 정한다.
 */
export function IllustrationVideo({ source, style, contentFit = 'cover' }: IllustrationVideoProps) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.muted = true;
    instance.play();
  });

  // 웹에서는 setup의 play()가 소스 준비 전에 실행돼 무시된다. 마운트 후 한 번 더 건다.
  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}
