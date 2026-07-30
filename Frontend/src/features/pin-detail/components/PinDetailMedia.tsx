import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import type { VideoSource } from 'expo-video';
import { colors } from '@/constants/theme';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
import { pinDetailStyles as s } from '../styles';

/**
 * signed URL이 아직 없어 미디어가 비어 있을 때 쓰는 시안 영상.
 *
 * Object Storage가 붙으면 서버가 준 URL을 쓰고 이 파일은 폴백으로만 남는다.
 */
const PLACEHOLDER_MEDIA = require('../../../../assets/videos/video-pin-crowd.mp4');

export interface PinDetailMediaProps {
  /** 결제해서 원본을 볼 수 있는 상태인지. 아니면 블러를 덮는다. */
  unlocked: boolean;
  /** 열람 가능할 때 서버가 준 원본 URL. */
  videoUrl: string | null;
  /** 열람 전에 서버가 준 미리보기 URL. */
  previewUrl: string | null;
}

/** 블러 세기. 자리 배치는 알아볼 수 있고 사람 얼굴과 좌석은 가려지는 정도. */
const BLUR_INTENSITY = 85;

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
 * 결제 전에는 `expo-blur`로 덮는다. `Image`의 `blurRadius`는 영상에 적용되지 않는다.
 */
export function PinDetailMedia({ unlocked, videoUrl, previewUrl }: PinDetailMediaProps) {
  // 열람 전에는 미리보기만 내려온다. 둘 다 비어 있으면 시안 영상으로 대체한다.
  const mediaUrl = unlocked ? videoUrl : previewUrl;
  const usesPlaceholder = !mediaUrl;
  const source: VideoSource = usesPlaceholder ? PLACEHOLDER_MEDIA : { uri: mediaUrl };

  const [muted, setMuted] = useState(true);

  const player = useAutoplayVideo(source, { loop: true, muted: true });

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

  return (
    <View style={s.videoFrame}>
      <VideoView
        player={player}
        style={usesPlaceholder ? s.placeholderVideoPlayer : s.videoPlayer}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {!unlocked && (
        <BlurView
          intensity={BLUR_INTENSITY}
          tint="light"
          // Android는 이 값을 줘야 실제로 블러가 걸린다. 없으면 반투명 막이 된다.
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
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
