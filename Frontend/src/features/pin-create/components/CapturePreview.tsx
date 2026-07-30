import { VideoView } from 'expo-video';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
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
  const player = useAutoplayVideo(uri, { loop: true, muted: false });

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
