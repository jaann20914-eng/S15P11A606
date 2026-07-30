import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MAX_VIDEO_SECONDS } from '@/types/pinCreate';
import type { PinDraftVideo } from '@/types/pinCreate';
import { useVideoCapture } from '../hooks/useVideoCapture';
import { pinCreateStyles as s } from '../styles';
import { CapturePreview } from './CapturePreview';

export interface CaptureFieldProps {
  video: PinDraftVideo | null;
  onCaptured: (video: PinDraftVideo | null) => void;
}

/** `0:00:05` 형태. 최대 5초라 분·시는 항상 0이지만 시안 표기를 따른다. */
function formatTimer(seconds: number): string {
  return `0:00:${String(seconds).padStart(2, '0')}`;
}

/**
 * 영상 촬영 영역.
 *
 * 갤러리 선택은 두지 않는다. 지금 현장이라는 것이 이 서비스의 전제이므로 실시간 촬영만 받는다.
 * 5초가 되면 카메라가 스스로 멈추고, 그 전에 버튼을 다시 누르면 거기서 끝난다.
 * 촬영이 끝나면 결과를 그 자리에서 재생해 보여주고 다시 찍을 수 있게 한다.
 */
export function CaptureField({ video, onCaptured }: CaptureFieldProps) {
  const capture = useVideoCapture(onCaptured);
  const { requestPermissions } = capture;

  // 화면에 들어오면 바로 권한을 물어야 미리보기를 띄울 수 있다.
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  if (capture.permissionMessage) {
    return (
      <View style={[s.camera, s.cameraBlocked]}>
        <Ionicons name="videocam-off-outline" size={28} color={colors.gray400} />
        <Text style={s.cameraBlockedText}>{capture.permissionMessage}</Text>
        <Pressable accessibilityRole="button" onPress={requestPermissions} style={s.cameraRetry}>
          <Text style={s.cameraRetryText}>권한 다시 요청</Text>
        </Pressable>
      </View>
    );
  }

  // 촬영이 끝났으면 카메라를 내리고 결과 영상을 보여준다.
  if (capture.state === 'done' && video) {
    return (
      <View style={s.camera}>
        <CapturePreview uri={video.uri} />

        <View style={s.captureMeta}>
          <Text style={s.captureHint}>최대 {MAX_VIDEO_SECONDS}초까지 촬영돼요</Text>
          <View style={s.timer}>
            <Text style={s.timerText}>{formatTimer(video.durationSeconds)}</Text>
          </View>
        </View>

        <Pressable accessibilityLabel="다시 촬영" onPress={capture.retake} style={s.cameraAction}>
          <Ionicons name="refresh" size={18} color={colors.white} />
        </Pressable>
      </View>
    );
  }

  const recording = capture.state === 'recording';

  return (
    <View style={s.camera}>
      {capture.ready ? (
        <CameraView
          ref={capture.cameraRef}
          facing={capture.facing}
          mode="video"
          videoQuality="720p"
          style={s.cameraView}
        />
      ) : (
        <View style={s.cameraBlocked}>
          <Text style={s.cameraBlockedText}>카메라를 준비하고 있어요</Text>
        </View>
      )}

      <View style={s.captureMeta}>
        {!recording && <Text style={s.captureHint}>최대 {MAX_VIDEO_SECONDS}초까지 촬영돼요</Text>}
        <View style={s.timer}>
          <Text style={s.timerText}>{formatTimer(capture.elapsedSeconds)}</Text>
        </View>
      </View>

      {/* 녹화 중에는 렌즈를 바꿀 수 없다. 중간에 바꾸면 녹화가 끊긴다. */}
      {!recording && capture.ready && (
        <Pressable
          accessibilityLabel="전면 · 후면 전환"
          onPress={capture.toggleFacing}
          style={s.cameraAction}
        >
          <Ionicons name="camera-reverse-outline" size={20} color={colors.white} />
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? '촬영 종료' : '촬영 시작'}
        disabled={!capture.ready}
        onPress={recording ? capture.stopRecording : capture.startRecording}
        style={s.recordOuter}
      >
        <View style={[s.recordInner, recording && s.recording]} />
      </Pressable>

    </View>
  );
}
