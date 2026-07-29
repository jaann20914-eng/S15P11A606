import { useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import { pinCreateStyles as s } from '../styles';

export interface CapturePreviewProps {
  /** 방금 촬영한 영상의 기기 경로. */
  uri: string;
}

/**
 * 촬영 결과 확인용 재생.
 *
 * 소리를 켠 채 반복 재생한다. 등록 전에 무엇이 담겼는지 눈과 귀로 확인해야 하기 때문이다.
 * 재생 위치를 되돌릴 컨트롤은 두지 않고 반복으로 대신한다.
 */
export function CapturePreview({ uri }: CapturePreviewProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.play();
  });

  // 웹에서는 setup의 play()가 소스 준비 전에 실행돼 무시된다. 마운트 후 한 번 더 건다.
  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={s.cameraView}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}
