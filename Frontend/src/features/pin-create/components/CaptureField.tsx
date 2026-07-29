import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MAX_VIDEO_SECONDS } from '@/types/pinCreate';
import type { PinDraftVideo } from '@/types/pinCreate';
import { pinCreateStyles as s } from '../styles';

/**
 * 카메라 미리보기 자리를 채우는 시안 이미지.
 *
 * 기기 카메라 연동 전까지만 쓴다. `expo-camera`가 붙으면 이 이미지는 사라진다.
 */
const PREVIEW_PLACEHOLDER = require('../../../../assets/images/capture-cafe-preview.png');

export interface CaptureFieldProps {
  video: PinDraftVideo | null;
  onCaptured: (video: PinDraftVideo | null) => void;
}

type RecordState = 'idle' | 'recording' | 'done';

/** `0:00:05` 형태. 최대 5초라 분·시는 항상 0이지만 시안 표기를 따른다. */
function formatTimer(seconds: number): string {
  return `0:00:${String(seconds).padStart(2, '0')}`;
}

/**
 * 영상 촬영 영역.
 *
 * 지금은 촬영 상태만 흉내내고 실제 녹화는 하지 않는다. 기기 카메라 연동은 다음 단계이며
 * 그때 이 컴포넌트 안만 바뀌고 화면과 폼은 그대로 쓴다.
 */
export function CaptureField({ video, onCaptured }: CaptureFieldProps) {
  const [state, setState] = useState<RecordState>(video ? 'done' : 'idle');

  const press = () => {
    if (state === 'idle') {
      setState('recording');
      return;
    }

    if (state === 'recording') {
      setState('done');
      // 실제 파일이 없어 경로는 비워 둔다. 카메라가 붙으면 녹화 결과 uri가 들어온다.
      onCaptured({ uri: '', durationSeconds: MAX_VIDEO_SECONDS });
      return;
    }

    // 재촬영. 이전 결과를 버리고 처음부터 다시 찍는다.
    setState('recording');
    onCaptured(null);
  };

  const retake = () => {
    setState('idle');
    onCaptured(null);
  };

  const elapsed = state === 'idle' ? 0 : state === 'recording' ? 3 : MAX_VIDEO_SECONDS;

  return (
    <View style={s.camera}>
      <Image source={PREVIEW_PLACEHOLDER} style={s.cameraImage} />

      <View style={s.timer}>
        <Text style={s.timerText}>{formatTimer(elapsed)}</Text>
      </View>

      {state === 'done' && (
        <Pressable accessibilityLabel="다시 촬영" onPress={retake} style={s.cameraAction}>
          <Ionicons name="refresh" size={18} color={colors.white} />
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state === 'recording' ? '촬영 종료' : '촬영 시작'}
        onPress={press}
        style={s.recordOuter}
      >
        <View
          style={[s.recordInner, state === 'recording' && s.recording, state === 'done' && s.recordDone]}
        />
      </Pressable>
    </View>
  );
}
