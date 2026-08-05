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
 * 카메라가 열렸다는 신호를 이만큼 기다린다(ms). 넘기면 새로 붙여 다시 시도한다.
 *
 * 안드로이드는 앞서 쓰던 카메라 세션을 언마운트 뒤에도 잠시 붙잡는다. 그 사이에 새 세션을
 * 열면 **실패를 알리지 않고 검은 화면으로 남는다** — 글을 하나 올리고 작성 화면에 다시
 * 들어오면 미리보기가 검고, 나갔다 들어와야 살아나던 이유다(2026-08-05).
 *
 * 그래서 "얼마나 기다리면 되는지"를 어림하지 않는다. 열렸다는 신호(`onCameraReady`)가
 * 오는지 보고, 오지 않으면 카메라를 새로 붙인다.
 */
const CAMERA_READY_TIMEOUT_MS = 1200;

/** 다시 붙여 보는 횟수의 상한. 이보다 더 하면 기기 문제이므로 안내로 넘긴다. */
const CAMERA_ATTACH_ATTEMPTS = 4;

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

  /**
   * 미리보기가 실제로 열렸는지. `onCameraReady`가 오면 참이 된다.
   *
   * 이 값을 믿고 그린다 — 권한이 있다는 것만으로는 카메라가 열렸다고 볼 수 없다(검은 화면이
   * 그 경우다).
   */
  const [previewLive, setPreviewLive] = useState(false);

  /**
   * 카메라를 몇 번째로 붙이는 중인지. 이 값이 `CameraView`의 key라서, 올리면 네이티브 쪽이
   * 완전히 새로 만들어진다.
   */
  const [attachAttempt, setAttachAttempt] = useState(0);

  /** 다시 붙여 볼 여지가 남았는지. 다 쓰면 안내로 넘긴다. */
  const canRetryAttach = attachAttempt < CAMERA_ATTACH_ATTEMPTS - 1;

  /*
    열렸다는 신호를 기다리다 오지 않으면 새로 붙인다.

    앞 세션이 아직 카메라를 붙잡고 있으면 이 시도는 조용히 실패한다. 그때 key를 올려 새로
    만들면 대개 다음 시도에서 열린다 — 그 사이 해제가 끝나기 때문이다.
  */
  useEffect(() => {
    if (previewLive || showsExisting || video !== null) return;
    if (!canRetryAttach) return;

    const timer = setTimeout(() => setAttachAttempt((current) => current + 1), CAMERA_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [previewLive, showsExisting, video, canRetryAttach, attachAttempt]);

  /*
    카메라를 쓰지 않는 상태로 갔다가 돌아오면 처음부터 다시 확인한다. 찍어 둔 영상을 보다가
    "다시 촬영"으로 돌아오는 길이 그렇다 — 그때도 세션을 새로 열어야 한다.
  */
  useEffect(() => {
    if (showsExisting || video !== null) {
      setPreviewLive(false);
      setAttachAttempt(0);
    }
  }, [showsExisting, video]);

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
      {/*
        카메라는 권한이 있으면 **항상 붙인다.** 붙이지 않으면 열렸다는 신호도 오지 않아
        준비 여부를 알 수 없다. 열리기 전에는 아래 안내 층이 위를 덮는다.

        `key`가 시도 번호다. 열리지 않아 다시 붙일 때 이 값이 올라가면 네이티브 쪽이 완전히
        새로 만들어진다.
      */}
      {capture.ready && (
        <CameraView
          key={attachAttempt}
          ref={capture.cameraRef}
          facing={capture.facing}
          mode="video"
          videoQuality="720p"
          style={s.cameraView}
          onCameraReady={() => setPreviewLive(true)}
          /*
            열지 못했다고 알려 오면 기다리지 않고 바로 다시 붙인다. 신호가 아예 오지 않는
            경우는 위 효과가 시간을 재서 처리한다.
          */
          onMountError={() => setAttachAttempt((current) => current + 1)}
        />
      )}

      {/* 아직 열리지 않았으면 그 사실을 덮어서 알린다. 검은 화면만 남기지 않는다. */}
      {!previewLive && (
        <View style={[s.cameraBlocked, s.cameraCover]}>
          <Text style={s.cameraBlockedText}>
            {canRetryAttach ? '카메라를 준비하고 있어요' : '카메라를 열지 못했어요. 앱을 다시 실행해 주세요.'}
          </Text>
        </View>
      )}

      <View style={s.captureMeta}>
        {!recording && <Text style={s.captureHint}>최대 {MAX_VIDEO_SECONDS}초까지 촬영돼요</Text>}
        <View style={s.timer}>
          <Text style={s.timerText}>{formatTimer(capture.elapsedSeconds)}</Text>
        </View>
      </View>

      {/* 녹화 중에는 렌즈를 바꿀 수 없다. 중간에 바꾸면 녹화가 끊긴다. */}
      {!recording && previewLive && (
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
        // 열리지 않은 카메라로는 녹화를 시작할 수 없다.
        disabled={!previewLive}
        onPress={recording ? capture.stopRecording : capture.startRecording}
        style={s.recordOuter}
      >
        <View style={[s.recordInner, recording && s.recording]} />
      </Pressable>
    </View>
  );
}
