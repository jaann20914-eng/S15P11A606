import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import type { VideoSource } from 'expo-video';
import { MediaLoadingSweep } from '@/components/common';
import { colors } from '@/constants/theme';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
import { warmedVideoSource } from '@/utils/videoWarmup';
import { pinDetailStyles as s } from '../styles';

/**
 * 전체화면 버튼을 내보내지 않는다. 컨트롤을 모두 끈 화면이라 들어갈 수단이 없다.
 *
 * 매 렌더마다 새 객체를 만들면 네이티브 쪽이 바뀐 것으로 보고 다시 설정하므로 상수로 둔다.
 */
const NO_FULLSCREEN = { enable: false } as const;

/**
 * signed URL이 아직 없어 미디어가 비어 있을 때 쓰는 시안 영상.
 *
 * Object Storage가 붙으면 서버가 준 URL을 쓰고 이 파일은 폴백으로만 남는다.
 */
const PLACEHOLDER_MEDIA = require('../../../../assets/videos/video-pin-crowd.mp4');

/**
 * 결제 전 블러 반경(dp).
 *
 * 여기까지 온 경위를 남긴다. 같은 시도를 반복하지 않기 위해서다.
 *
 * 1. `expo-blur`의 `BlurView`는 영상을 가리지 못한다. 안드로이드 구현이 상위 뷰를 비트맵에
 *    다시 그려서 흐리게 하는데, 영상 표면은 그 캔버스에 아무것도 그리지 않는다. 그래서
 *    반투명 막만 남아 영상이 그대로 보이고, `intensity`를 올리면 막이 진해져 "흰 판을 덮은"
 *    모양이 된다.
 * 2. 영상을 작게 그린 뒤 확대하는 방법도 안 된다. GPU가 영상 텍스처를 최종 크기로 다시
 *    샘플링하므로 레이아웃 크기가 세부를 지워주지 않는다. 배율을 24까지 올려도 결과가 같았다.
 *
 * `filter`는 방식이 다르다. 스냅샷을 뜨지 않고 뷰의 렌더 노드에 직접 효과를 걸기 때문에
 * 영상 표면도 함께 흐려진다. 웹에서는 CSS `filter`로 매핑돼 같은 결과가 나온다.
 *
 * 값이 크면 더 흐려진다. 자리 배치는 알아볼 수 있고 사람과 좌석은 가려지는 정도로 잡았다.
 */
const PREVIEW_BLUR_RADIUS = 24;

/** 결제 전 영상에 거는 블러. 프레임을 그대로 채운다. */
const PREVIEW_BLUR_STYLE: ViewStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  filter: [{ blur: PREVIEW_BLUR_RADIUS }],
};

/**
 * 안드로이드에서 영상을 그리는 표면 종류.
 *
 * 기본값 `surfaceView`는 뷰 계층 밖의 별도 레이어에 그려진다. 그러면 상위 뷰에 건 효과가
 * 영상에 닿지 않으므로 블러가 걸리지 않는다. `textureView`는 일반 그리기 경로를 타서 상위
 * 뷰의 렌더 효과에 함께 포함된다.
 *
 * 이 값과 `filter`는 함께 가야 한다. 하나만 두면 블러가 영상을 비껴간다.
 */
const PREVIEW_SURFACE_TYPE = 'textureView' as const;

export interface PinDetailMediaProps {
  /** 결제해서 원본을 볼 수 있는 상태인지. 아니면 세부를 지워서 보여준다. */
  unlocked: boolean;
  /** 열람 가능할 때 서버가 준 원본 URL. */
  videoUrl: string | null;
  /** 열람 전에 서버가 준 미리보기 URL. */
  previewUrl: string | null;
}

/**
 * 핀 상세 상단의 현장 영상.
 *
 * 결제 여부와 무관하게 무한 반복 재생한다. 미리보기 단계에서도 정지 화면이 아니라
 * 움직이는 화면을 보여줘야 "지금 현장"이라는 게 전달된다.
 *
 * 소리는 음소거로 시작하고 사용자가 버튼을 눌러야 켜진다. 화면에 들어오자마자
 * 소리가 나면 안 되고, 웹은 음소거가 아니면 자동재생 자체가 막힌다.
 * 결제 전에는 현장 소음도 유료 정보에 해당하므로 버튼을 내보내지 않는다.
 *
 * 결제 전에 가리는 방법은 `PREVIEW_BLUR_RADIUS` 설명을 참고한다.
 */
export function PinDetailMedia({ unlocked, videoUrl, previewUrl }: PinDetailMediaProps) {
  // 열람 전에는 미리보기만 내려온다. 둘 다 비어 있으면 시안 영상으로 대체한다.
  const mediaUrl = unlocked ? videoUrl : previewUrl;
  const usesPlaceholder = !mediaUrl;
  const source: VideoSource = usesPlaceholder ? warmedVideoSource(PLACEHOLDER_MEDIA) : { uri: mediaUrl };

  const [muted, setMuted] = useState(true);

  const player = useAutoplayVideo(source, { loop: true, muted: true });

  /**
   * 첫 프레임이 나올 준비가 됐는지.
   *
   * 준비되기 전에는 프레임이 회색 판으로 남아, 받는 중인지 실패했는지 알 수 없었다. 그동안
   * 무언가 오고 있다는 것을 보여주기 위해 상태를 따라간다.
   *
   * 기준은 **서명을 뗀 영상 키**다. 영상이 실제로 바뀌면(수정에서 교체) 준비 상태를 되돌려
   * 로딩이 덮게 한다 — 옛 상태를 그대로 두면 교체 직후 **옛 영상이 한 번 떴다가 새 영상으로
   * 튀었다**(2026-08-05). 같은 영상의 서명만 갱신된 재조회에서는 되돌리지 않는다(플레이어도
   * 다시 싣지 않는다 — `useAutoplayVideo`).
   */
  const mediaKey = mediaUrl ? mediaUrl.split('?')[0] : 'placeholder';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });

    return () => subscription.remove();
  }, [player, mediaKey]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  /**
   * 결제 전후가 바뀌면 재생을 한 번 더 건다.
   *
   * 결제 모달이 닫힐 때 그 안의 일러스트 영상 플레이어가 정리되는데, 그 과정에서 이쪽 재생이
   * 함께 멈추는 경우가 있다. 목업에서는 결제 전후 소스가 같아 플레이어가 그대로 남으므로
   * 스스로 다시 시작하지 않는다. 이미 재생 중이면 이 호출은 아무 일도 하지 않는다.
   */
  useEffect(() => {
    player.play();
  }, [player, unlocked]);

  const toggleMuted = useCallback(() => setMuted((previous) => !previous), []);

  const video = (
    <VideoView
      player={player}
      style={usesPlaceholder ? s.placeholderVideoPlayer : s.videoPlayer}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={NO_FULLSCREEN}
      allowsPictureInPicture={false}
      // 블러가 영상까지 닿아야 한다. PREVIEW_SURFACE_TYPE 설명 참고.
      surfaceType={PREVIEW_SURFACE_TYPE}
    />
  );

  return (
    <View style={s.videoFrame}>
      {/* 결제 전에는 영상을 감싼 뷰에 블러를 걸어 함께 흐려지게 한다. */}
      {unlocked ? (
        video
      ) : (
        <View style={PREVIEW_BLUR_STYLE} pointerEvents="none">
          {video}
        </View>
      )}

      {/*
        영상을 받는 동안 그 자리를 채운다.

        회색 판만 남겨 두면 받는 중인지 실패했는지 알 수 없다. 판 위로 빛줄기가 지나가며 이
        자리가 채워지는 중임을 알린다. 준비되면 사라진다.
      */}
      {!ready && <MediaLoadingSweep />}

      {/* 결제 전에는 소리도 유료 정보라 켤 수 없게 버튼 자체를 숨긴다. */}
      {unlocked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? '소리 켜기' : '소리 끄기'}
          onPress={toggleMuted}
          style={s.muteToggle}
          // 손가락으로 누르기에 아이콘이 작아 눌리는 영역을 넓힌다.
          hitSlop={8}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}
