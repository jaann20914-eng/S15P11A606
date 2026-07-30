import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import type { VideoUploadPhase } from '@/types/pinCreate';
import { pinCreateStyles as s } from '../styles';

/** 한 바퀴 도는 데 걸리는 시간. */
const SPIN_DURATION_MS = 1050;

export interface PublishingOverlayProps {
  phase: VideoUploadPhase;
  /** 업로드 진행률 0~1. `uploading` 단계에서만 표시한다. */
  progress: number;
  /** 업로드를 중단한다. 등록 요청까지 간 뒤에는 되돌릴 수 없어 숨긴다. */
  onCancel: () => void;
}

/**
 * 단계별 안내. 지금 무엇을 기다리는지 알 수 있어야 한다.
 *
 * 다른 화면으로 이동해도 업로드는 계속된다. 앱을 종료할 때만 중단되므로 그렇게 안내한다.
 */
const messageByPhase: Record<VideoUploadPhase, string> = {
  idle: '',
  issuing: '업로드를 준비하고 있어요',
  uploading: '영상을 올리고 있어요\n다른 화면으로 이동해도 계속돼요',
  registering: '등록을 접수하고 있어요',
  processing: 'AI를 이용하여\n블러 처리중입니다\n앱을 종료하는 경우에만\n업로드가 중단됩니다',
  done: '처리가 끝났어요',
};

/**
 * 등록 진행 화면.
 *
 * 발급 → 업로드 → 등록을 거치는 동안 이 화면에 머문다. 업로드 중에는 퍼센트를 보여주고
 * 중단할 수 있게 한다. 등록 요청을 보낸 뒤에는 서버에 이미 접수되었을 수 있어 취소를 막는다.
 */
export function PublishingOverlay({ phase, progress, onCancel }: PublishingOverlayProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const uploading = phase === 'uploading';

  return (
    <View style={s.publishing}>
      <View style={[s.ambient, s.ambientWarm]} />
      <View style={[s.ambient, s.ambientBlue]} />

      <View style={s.loaderWrap}>
        <Animated.View style={[s.loaderTrack, { transform: [{ rotate }] }]}>
          <View style={s.loaderMask} />
        </Animated.View>
        <View style={s.loaderCenter}>
          <Text style={s.publishingText}>{messageByPhase[phase]}</Text>
          {uploading && <Text style={s.publishingProgress}>{Math.round(progress * 100)}%</Text>}
        </View>
      </View>

      {(phase === 'issuing' || uploading) && (
        <Pressable accessibilityRole="button" onPress={onCancel} style={s.publishingCancel}>
          <Text style={s.publishingCancelText}>취소</Text>
        </Pressable>
      )}
    </View>
  );
}
