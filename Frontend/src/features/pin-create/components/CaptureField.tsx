import { useEffect, useState } from 'react';
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
  /**
   * 수정에서 이미 등록돼 있는 영상.
   *
   * 있으면 카메라 대신 그 영상을 먼저 보여준다. 내용만 고치러 들어온 사람에게 카메라를 먼저
   * 내밀면 다시 찍어야 하는 것으로 읽힌다 — 영상을 그대로 두는 것이 기본이다.
   */
  existingVideoUrl?: string | null;
}

/**
 * 카메라를 붙이기까지 기다리는 시간(ms).
 *
 * 앞 세션이 해제될 틈을 주는 값이다. 너무 짧으면 검은 화면이 그대로 남고, 길면 처음
 * 들어오는 사람이 기다린다. 실기기에서 이 값이면 안정적으로 열렸다.
 */
const CAMERA_ATTACH_DELAY_MS = 350;

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
export function CaptureField({ video, onCaptured, existingVideoUrl = null }: CaptureFieldProps) {
  const capture = useVideoCapture(onCaptured);
  const { requestPermissions } = capture;

  /**
   * 등록된 영상을 두고 다시 찍기로 했는지.
   *
   * 수정에서만 쓰인다. 누르기 전에는 카메라를 열지 않는다 — 열어 두면 권한을 묻고 카메라를
   * 켜는 비용이 들고, 대부분은 영상을 그대로 두고 글만 고친다.
   */
  const [retaking, setRetaking] = useState(false);

  /** 등록된 영상을 보여주는 중인지. 다시 찍었으면 그 결과가 우선한다. */
  const showsExisting = existingVideoUrl !== null && !retaking && video === null;

  /*
    카메라를 붙이기 전에 잠깐 기다린다.

    안드로이드는 앞서 쓰던 카메라 세션을 언마운트 뒤에도 잠시 붙잡고 있다. 그 사이에 새
    세션을 열면 실패하는데, 실패를 알리지 않고 **검은 화면으로 남는다** — 글을 하나 올리고
    작성 화면에 다시 들어오면 미리보기가 검게 뜨고, 나갔다 들어와야 살아나던 이유다
    (2026-08-05). 짧게 늦추면 그 사이 해제가 끝난다.

    지연 동안에는 "준비 중" 안내가 보인다. 카메라가 열리는 데 어차피 그만큼 걸리므로 처음
    들어오는 사람에게도 느려지지 않는다.
  */
  const [cameraSlotReady, setCameraSlotReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCameraSlotReady(true), CAMERA_ATTACH_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // 화면에 들어오면 바로 권한을 물어야 미리보기를 띄울 수 있다.
  useEffect(() => {
    // 등록된 영상을 보여주는 중이면 카메라를 쓰지 않으므로 묻지 않는다.
    if (showsExisting) return;

    requestPermissions();
  }, [requestPermissions, showsExisting]);

  /*
    수정 진입 직후 — 지금 올라가 있는 영상을 그대로 보여준다.

    "다시 촬영"을 누르면 카메라로 바뀐다. 그때 찍은 것만 교체 요청으로 이어지고, 누르지 않으면
    영상은 손대지 않는다.
  */
  if (showsExisting) {
    return (
      <View style={s.camera}>
        <CapturePreview uri={existingVideoUrl} />

        <View style={s.captureMeta}>
          <Text style={s.captureHint}>지금 올라가 있는 영상이에요</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 촬영"
          onPress={() => setRetaking(true)}
          style={s.cameraAction}
        >
          <Ionicons name="refresh" size={18} color={colors.white} />
        </Pressable>
      </View>
    );
  }

  /*
    찍어 둔 영상이 있으면 카메라 대신 그 영상을 보여준다. 권한 확인보다도 먼저다 — 영상은
    이미 손에 있으니 카메라를 쓸 수 있는지와 무관하게 보여야 한다.

    촬영 상태(`capture.state`)가 아니라 **영상이 있는지**로 판단한다. 촬영 상태는 이 컴포넌트의
    것이라 화면이 잠깐 갈렸다 돌아오면(등록 실패 안내 뒤 진행 화면이 내려갈 때) 처음으로
    돌아가는데, 그때 영상이 멀쩡히 남아 있는데도 카메라가 떠서 지워진 것처럼 보였다.
    영상은 폼에 있어 그 교체를 견딘다.
  */
  if (video) {
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

  const recording = capture.state === 'recording';

  return (
    <View style={s.camera}>
      {capture.ready && cameraSlotReady ? (
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
      {!recording && capture.ready && cameraSlotReady && (
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
        disabled={!capture.ready || !cameraSlotReady}
        onPress={recording ? capture.stopRecording : capture.startRecording}
        style={s.recordOuter}
      >
        <View style={[s.recordInner, recording && s.recording]} />
      </Pressable>
    </View>
  );
}
