import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { VideoView } from 'expo-video';
import { MediaLoadingSweep } from '@/components/common';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
import { pinCreateStyles as s } from '../styles';

/**
 * 전체화면 버튼을 내보내지 않는다. 컨트롤을 모두 끈 화면이라 들어갈 수단이 없다.
 *
 * 매 렌더마다 새 객체를 만들면 네이티브 쪽이 바뀐 것으로 보고 다시 설정하므로 상수로 둔다.
 */
const NO_FULLSCREEN = { enable: false } as const;

export interface CapturePreviewProps {
  /** 방금 촬영한 영상의 기기 경로, 또는 수정에서 보여주는 기존 영상의 서버 URL. */
  uri: string;
}

/**
 * 촬영 결과 확인용 재생.
 *
 * 소리를 켠 채 반복 재생한다. 등록 전에 무엇이 담겼는지 눈과 귀로 확인해야 하기 때문이다.
 * 재생 위치를 되돌릴 컨트롤은 두지 않고 반복으로 대신한다.
 *
 * 준비되기 전에는 상세 화면과 같은 빛줄기 로딩을 얹는다. 수정에서 보여주는 기존 영상은
 * 서버에서 받아오느라 몇 초 걸리는데, 그동안 검은 판만 있으면 영상이 없는 것처럼 보인다.
 * 방금 찍은 영상(기기 파일)은 바로 준비되므로 이 층이 스치지도 않는다.
 */
export function CapturePreview({ uri }: CapturePreviewProps) {
  const player = useAutoplayVideo(uri, { loop: true, muted: false });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(player.status === 'readyToPlay');

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });

    return () => subscription.remove();
  }, [player, uri]);

  return (
    <View style={s.cameraView}>
      <VideoView
        player={player}
        style={s.cameraView}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={NO_FULLSCREEN}
        allowsPictureInPicture={false}
        pointerEvents="none"
      />

      {!ready && <MediaLoadingSweep />}
    </View>
  );
}
